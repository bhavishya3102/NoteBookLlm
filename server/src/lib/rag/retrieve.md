# `retrieve.ts` — dono functions ka flow example ke sath

Ye file RAG ka **"R" aur "A"** hai:

- **`retrieveWorkspaceContext`** — **R**etrieval. User ke sawaal se related chunks Pinecone se dhundo.
- **`buildChatSystemPrompt`** — **A**ugmentation. Un chunks ko (aur memories, summary ko) ek prompt string mein ghol do.

Teesra "G" (Generation) [chat.service.ts](../../services/chat.service.ts) mein hota hai. Ye file uske liye kacha maal taiyaar karti hai.

Poora RAG loop:

```
Sawaal → [retrieveWorkspaceContext] → chunks
                                        ↓
       [buildChatSystemPrompt] → system prompt → LLM → jawab
```

---

# Function 1 — `retrieveWorkspaceContext`

## Setup

User **"Rust Book"** workspace (`ws_01`) mein poochta hai:

```js
retrieveWorkspaceContext("ws_01", "Ownership kya hai?")
```

Workspace mein 120 chunks pehle se Pinecone mein indexed hain ([source-processing.service.md](../../services/source-processing.service.md) waale flow se).

## Step 1 — Sawaal ko vector banao (line 37)

```ts
const [embedding] = await embedTexts([query]);
```

```js
"Ownership kya hai?"  →  [0.031, -0.087, 0.442, ... ]   // 1536 numbers
```

**Yahan ek cheez ekdum critical hai:** ye wahi `embedTexts` function hai jo indexing ke waqt use hua tha, isliye wahi model (`text-embedding-3-small`) aur wahi dimensions (1536) hain.

Agar indexing kisi aur model se hoti aur query kisi aur se, to dono vectors alag "coordinate system" mein hote aur similarity comparison **bilkul bekaar** ho jaata — koi crash nahi hota, bas results random aane lagte. Ye RAG ka sabse chupa hua bug hai. Isiliye dono taraf ek hi `ai-config.ts` constant use hota hai.

Note `[embedding]` par — array destructuring. `embedTexts` hamesha array return karta hai (kyunki wo batch handle karta hai), humne ek hi text bheja to pehla element nikal liya.

## Step 2 — Pinecone se search (line 38-42)

```ts
const matches = await queryWorkspaceVectors(workspaceId, embedding, RAG_TOP_K);
```

[pinecone.ts:172](../pinecone.ts#L172) ke andar:

```ts
const result = await index.namespace(workspaceId).query({
    vector, topK, includeMetadata: true,
});
```

Teen baatein:

**`.namespace(workspaceId)`** — ye **security boundary** hai. Har workspace ka apna namespace hai, to `ws_01` ki query kabhi `ws_02` ke vectors nahi chhoo sakti. Data isolation query-level filter se nahi, **storage-level separation** se ho raha hai — jo kahin zyada mazboot hai.

**`topK: RAG_TOP_K`** = 6 ([ai-config.ts:20](../ai-config.ts#L20)). 120 mein se sabse similar 6 chunks.

**`includeMetadata: true`** — sirf ids nahi, poora metadata bhi bhejo. Yahi wo `text` laata hai jo humne indexing ke waqt jaan-boojh kar metadata mein daala tha. Isi ki wajah se ab **Postgres ko dobara query karne ki zaroorat nahi** — ek Pinecone call mein hi sab mil gaya.

Wapas aata hai (cosine similarity ke hisaab se sorted, sabse zyada pehle):

```js
matches = [
  { id: "chk_88", score: 0.89, metadata: { sourceTitle: "Rust Book", text: "Ownership is Rust's...", page: 47, ... } },
  { id: "chk_89", score: 0.81, metadata: { sourceTitle: "Rust Book", text: "Each value has an owner...", page: 48, ... } },
  { id: "chk_12", score: 0.44, metadata: { sourceTitle: "Rust Book", text: "Variables and mutability...", page: 12, ... } },
  { id: "chk_50", score: 0.31, metadata: { ... } },   // ← ye kam relevant hai
  { id: "chk_71", score: 0.22, metadata: { ... } },   // ← ye to bilkul bekaar
  { id: "chk_03", score: 0.18, metadata: { ... } },   // ← ye bhi
]
```

Dhyaan do: Pinecone **hamesha 6 results deta hai**, chahe wo relevant ho ya na ho. Wo bas "sabse kam bura" 6 dhoondh ke de deta hai. Filter humein khud lagana padega.

## Step 3 — Score filter (line 46-49)

```ts
for (const match of matches) {
    const score = match.score ?? 0;
    if (score < RAG_MIN_SCORE) {
        continue;
    }
```

`RAG_MIN_SCORE = 0.35` ([ai-config.ts:23](../ai-config.ts#L23)). Humare 6 matches par:

| chunk | score | 0.35 se upar? | natija |
| --- | --- | --- | --- |
| chk_88 | 0.89 | haan | rakha |
| chk_89 | 0.81 | haan | rakha |
| chk_12 | 0.44 | haan | rakha |
| chk_50 | 0.31 | nahi | **skip** |
| chk_71 | 0.22 | nahi | **skip** |
| chk_03 | 0.18 | nahi | **skip** |

6 mein se 3 bache.

**Ye filter kyun itna zaroori hai?** Ek extreme example lo — user "Rust Book" workspace mein poochta hai *"aaj mausam kaisa hai?"*. Pinecone phir bhi 6 chunks dega, kyunki usse *kuch to* return karna hi hai. Bina filter ke wo 6 random Rust paragraphs prompt mein chale jaate, aur LLM confuse hoke mausam ka jawab Rust ownership se jodne ki koshish karta.

Filter ke sath: sabke score `0.35` se neeche → `chunks = []` → prompt builder khud bol deta hai "nothing relevant was retrieved, general knowledge se jawab do." Clean.

`match.score ?? 0` — agar Pinecone kisi wajah se score na bheje to `0` maan lo, matlab filter ho jaayega. Safe default: shak ho to chhod do.

## Step 4 — Metadata validation (line 51-63)

```ts
const metadata = match.metadata as Record<string, unknown> | undefined;
if (
    !metadata ||
    typeof metadata.sourceId !== "string" ||
    typeof metadata.sourceTitle !== "string" ||
    typeof metadata.sourceType !== "string" ||
    typeof metadata.chunkId !== "string" ||
    typeof metadata.text !== "string"
) {
    continue;
}
```

Ye **runtime type check** hai. Zaroori kyun?

Kyunki Pinecone ek **external service** hai. TypeScript ka `as Record<string, unknown>` sirf compile time pe hai — runtime pe koi guarantee nahi ki wahan sach mein kya aayega. Aur Pinecone mein vectors purane code se, kisi migration se, ya manually bhi daale ja sakte hain.

Practical example: aapne pehle purana schema use kiya tha jisme `sourceTitle` field thi hi nahi. Wo purane vectors abhi bhi index mein pade hain. Bina is check ke:

```js
`[1] ${chunk.sourceTitle}`   →   "[1] undefined"     // LLM ke prompt mein!
```

LLM ko "undefined" naam ka source dikhta, aur wo user ko citation `[1] undefined` de deta. Is check ke sath wo record chup-chaap skip ho jaata hai.

**Design choice:** yahan `throw` nahi kiya gaya, `continue` kiya gaya. Ek kharab vector poori chat ko todna nahi chahiye — baaki 2 achhe chunks se jawab ban jaayega. Ye **graceful degradation** hai.

## Step 5 — Clean object banao (line 65-77)

```ts
chunks.push({
    sourceId: metadata.sourceId,
    sourceTitle: metadata.sourceTitle,
    sourceType: metadata.sourceType,
    chunkId: metadata.chunkId,
    chunkIndex: Number(metadata.chunkIndex ?? 0),
    ...(typeof metadata.page === "number" ? { page: metadata.page } : {}),
    text: metadata.text,
    score,
});
```

Do detail:

**`Number(metadata.chunkIndex ?? 0)`** — `chunkIndex` ke liye upar `typeof` check nahi hai (baaki fields ke liye tha). Kyunki ye critical nahi hai — display ya citation matching mein use hota hai. Missing ho to `0` chalega. Isliye validation ki jagah coercion.

**Conditional spread** — wahi pattern jo indexing side pe tha ([source-processing.service.md](../../services/source-processing.service.md)). PDF chunk mein `page` hoga, YouTube/text chunk mein nahi. `page: undefined` set karne se `RetrievedChunk` type ka `page?: number` optional contract toot jaata — key hoti hi nahi, ye behtar hai.

## Final output

```js
[
  { sourceId: "src_99", sourceTitle: "Rust Book", sourceType: "PDF",
    chunkId: "chk_88", chunkIndex: 88, page: 47,
    text: "Ownership is Rust's most unique feature...", score: 0.89 },
  { ... chunkId: "chk_89", page: 48, text: "Each value has an owner...", score: 0.81 },
  { ... chunkId: "chk_12", page: 12, text: "Variables and mutability...", score: 0.44 },
]
```

Order **score ke hisaab se** hai (Pinecone se aisa hi aaya, aur loop ne order preserve kiya). Ye aage kaam aayega — sabse relevant chunk `[1]` banega.

---

# Function 2 — `buildChatSystemPrompt`

Ab in chunks ko ek prompt string mein badalna hai. Ye function **pure hai** — koi DB, koi API call nahi, sirf string jodna. Isliye test karna bhi aasan hai.

## Design: sections array

```ts
const sections: string[] = [
    "You are Chaibook, an assistant that helps users learn from their workspace sources.",
];
```

Poora function ek hi pattern par chalta hai: **conditionally `sections` mein push karo, aakhir mein `\n` se join kar do**. Isse har block optional ban jaata hai bina nested string templates ke.

## Setup — input kya aata hai

```js
buildChatSystemPrompt({
  chunks: [ /* upar wale 3 chunks */ ],
  conversationSummary: "User Rust seekh raha hai, syntax basics discuss kiye...",
  userMemories: ["User is a beginner programmer", "User knows Python"],
  webSearchEnabled: false,
})
```

## Block 1 — Identity (hamesha)

```
You are Chaibook, an assistant that helps users learn from their workspace sources.
```

## Block 2 — Web search rules (line 102-108)

```ts
if (input.webSearchEnabled) {
    sections.push(
        "You have access to a web_search tool for up-to-date information outside the workspace.",
        "Use it when the user asks about recent events or topics not covered by their sources.",
        "Cite web results inline using [W1], [W2], etc. matching the web result blocks.",
    );
}
```

Humare example mein `false` hai → skip.

Par jab `true` ho, tab dhyaan do: **web citations `[W1]` hain, document citations `[1]`**. Alag prefix isliye ki LLM dono ko mix na kar de, aur frontend `[W1]` ko external link aur `[1]` ko source card ke roop mein render kar sake.

Aur ye instructions tabhi jaati hain jab tool actually available ho. Agar tool na hote hue bhi ye likh dete, to LLM aisa tool call karne ki koshish karta jo maujood hi nahi.

## Block 3 — User memories (line 110-119)

```ts
if (input.userMemories?.length) {
    const memoryBlock = input.userMemories.map((memory) => `- ${memory}`).join("\n");
    sections.push("Known facts about this user (use when relevant):", memoryBlock);
}
```

Add hota hai:

```
Known facts about this user (use when relevant):
- User is a beginner programmer
- User knows Python
```

`(use when relevant)` phrase soch samajh ke likha hai. Bina iske LLM har jawab mein "Since you're a beginner who knows Python..." thopne lagta, chahe sawaal ka usse koi lena-dena na ho. Ye LLM ko **discretion** deta hai.

`?.length` check dono handle karta hai — `undefined` bhi aur khaali array bhi. Khaali "Known facts:" heading bina kisi fact ke prompt mein jaana bekaar hai.

## Block 4 — Conversation summary (line 121-124)

```ts
const summary = input.conversationSummary?.trim();
if (summary) {
    sections.push("Earlier conversation summary:", summary);
}
```

```
Earlier conversation summary:
User Rust seekh raha hai, syntax basics discuss kiye...
```

`.trim()` pehle karke phir truthy check — isse whitespace-only string (`"   "`) bhi filter ho jaati hai. Sirf `if (input.conversationSummary)` likhte to `"   "` truthy hoti aur khaali heading chali jaati.

Ye summary hi wo cheez hai jo [chat.service.ts](../../services/chat.service.ts) ko purane messages kaatne ki ijazat deti hai — purani baatein yahan compressed roop mein maujood hain.

## Block 5A — **Early return** jab koi chunk na ho (line 126-135)

```ts
if (input.chunks.length === 0) {
    sections.push(
        "This workspace has no indexed source content yet, or nothing relevant was retrieved.",
        input.webSearchEnabled
            ? "Use web search when needed, or answer from general knowledge."
            : "Answer helpfully from general knowledge and suggest adding or processing sources when appropriate.",
        "Do not invent citations.",
    );
    return sections.join("\n");        // ← yahi return, aage nahi jaate
}
```

Ye poore function ka sabse mehnat se socha gaya hissa hai. Do bilkul alag situations yahan aake milti hain:

1. Workspace khaali hai (koi source upload hi nahi hua)
2. Sources hain par is sawaal se koi match nahi (score filter ne sab uda diye)

LLM ke liye **dono ka jawab same hai** — "tumhare paas context nahi hai, general knowledge se kaam chalao" — isliye ek hi message dono ko cover karta hai.

`"Do not invent citations."` sabse important line hai. Bina iske LLM habit se `[1]`, `[2]` likh deta hai (kyunki uske training data mein aisa bahut hai), aur frontend un numbers ko match karne ki koshish karega — jabki `citations` array khaali hai. Result: toota hua UI ya khaali source cards.

`return` yahan zaroori hai warna neeche "Use ONLY the retrieved context below" wali lines bhi push ho jaatin — aur "context ka istemaal karo" bolna jab context hai hi nahi, LLM ke liye ek contradiction hai.

## Block 5B — Context blocks (line 137-155)

Humare case mein 3 chunks hain, to yahan aayenge:

```ts
const context = input.chunks
    .map((chunk, index) => {
        const label = `[${index + 1}] ${chunk.sourceTitle} (${chunk.sourceType})${
            chunk.page ? `, page ${chunk.page}` : ""
        }`;
        return `${label}\n${chunk.text}`;
    })
    .join("\n\n");
```

`index + 1` isliye ki humans 1 se ginte hain, `[0]` weird lagta. Aur `chunk.page ? ... : ""` — PDF ke liye page number, YouTube/text ke liye kuch nahi.

Banta hai:

```
[1] Rust Book (PDF), page 47
Ownership is Rust's most unique feature...

[2] Rust Book (PDF), page 48
Each value has an owner...

[3] Rust Book (PDF), page 12
Variables and mutability...
```

**Ye numbering poore app ka contract hai.** Wahi order `chat.service.ts` mein `citations` array ka bhi hai. To jab LLM `[2]` likhta hai, frontend `citations[1]` uthata hai aur "Rust Book, page 48" ka clickable card bana deta hai. Isiliye numbering aur array order **kabhi alag nahi hone chahiye**.

```ts
sections.push(
    "Use ONLY the retrieved context below when making factual claims about their materials.",
    "If the context is insufficient, say so clearly.",
    "Cite sources inline using [1], [2], etc. matching the numbered context blocks.",
    "Keep answers concise, accurate, and educational.",
    "",
    "Retrieved context:",
    context,
);
```

Chaar rules, har ek ka apna kaam:

| Rule | Kya rokta/karta hai |
| --- | --- |
| "Use ONLY the retrieved context" | hallucination — LLM apni general knowledge ko document ka content bataye |
| "If insufficient, say so" | LLM ka gaps bharne ka natural urge — "pata nahi" bolna allowed hai |
| "Cite using [1], [2]" | citations UI ko kaam karne deta hai |
| "concise, accurate, educational" | tone |

`""` (khaali string) ek **blank line** deta hai join hone ke baad — isse "Retrieved context:" wala hissa rules se visually alag ho jaata hai. LLM ke liye bhi ye structure signal hai.

## Final output

```
You are Chaibook, an assistant that helps users learn from their workspace sources.
Known facts about this user (use when relevant):
- User is a beginner programmer
- User knows Python
Earlier conversation summary:
User Rust seekh raha hai, syntax basics discuss kiye...
Use ONLY the retrieved context below when making factual claims about their materials.
If the context is insufficient, say so clearly.
Cite sources inline using [1], [2], etc. matching the numbered context blocks.
Keep answers concise, accurate, and educational.

Retrieved context:
[1] Rust Book (PDF), page 47
Ownership is Rust's most unique feature...

[2] Rust Book (PDF), page 48
Each value has an owner...

[3] Rust Book (PDF), page 12
Variables and mutability...
```

Yahi string `streamText({ system: ... })` mein jaati hai.

---

## Poora flow ek nazar mein

```
"Ownership kya hai?"
        │
        ▼
┌─────────────── retrieveWorkspaceContext ───────────────┐
│  embedTexts(["Ownership kya hai?"])                    │
│      → [0.031, -0.087, ...]  1536 dims                 │
│                                                        │
│  queryWorkspaceVectors("ws_01", vec, topK=6)           │
│      → 6 matches (0.89, 0.81, 0.44, 0.31, 0.22, 0.18)  │
│                                                        │
│  har match par:                                        │
│      score < 0.35 ?        → skip  (3 gaye)            │
│      metadata valid ?      → skip agar nahi            │
│      clean object banao    → chunks.push()             │
│                                                        │
│  → 3 RetrievedChunk                                    │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────── buildChatSystemPrompt ──────────────────┐
│  sections = ["You are Chaibook..."]                    │
│    + webSearch rules?     (false → skip)               │
│    + memories?            (2 hain → push)              │
│    + summary?             (hai → push)                 │
│    + chunks.length === 0? (nahi → aage)                │
│    + "[1] [2] [3]" context blocks + 4 rules            │
│                                                        │
│  → sections.join("\n")                                 │
└────────────────────────────────────────────────────────┘
        │
        ▼
   streamText({ system: prompt, ... })  → LLM
```

## Chaar cheezein yaad rakhne layak

**1. Query aur indexing ka embedding model same hona chahiye** — warna koi error nahi aayega, bas search silently bekaar ho jaayega. RAG ka sabse chupa hua bug yahi hai.

**2. `RAG_MIN_SCORE` filter Pinecone ki kami poori karta hai** — Pinecone hamesha `topK` results deta hai chahe kuch relevant ho ya na ho. "Kuch nahi mila" wali state humein khud banani padti hai.

**3. External data par hamesha runtime validation** — TypeScript ka `as` sirf compile time pe hai. Pinecone se aaye metadata ko `typeof` se check karna hi padta hai, aur kharab record par `throw` nahi `continue` — ek bura vector poori chat na tode.

**4. Citation numbering ek contract hai** — `[1]`, `[2]` ka order `chat.service.ts` ke `citations` array se exactly match karta hai. Ek jagah order badla to citations poore app mein galat source dikhane lagenge.
