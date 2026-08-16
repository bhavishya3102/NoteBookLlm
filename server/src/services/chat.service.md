# `streamWorkspaceChat` — flow example ke sath

Ye poore app ka **dil** hai. Jab user chat box mein kuch type karke Enter dabata hai, sab kuch yahi function handle karta hai — [chat.service.ts:217-387](./chat.service.ts#L217-L387).

Ek line mein: *user ka sawaal lo → uske documents aur uski memories dhundo → LLM ko sab context ke sath bhejo → jawab live stream karo → background mein sab kuch save karo.*

## Setup — request kya aati hai

Maan lo user **"Rust Book"** workspace mein hai, 3 message pehle ho chuke hain, aur ab poochta hai *"Ownership kya hai?"*. Frontend se ye aata hai:

```js
streamWorkspaceChat(res, "ws_01", "user_42", {
  conversationId: "conv_77",
  messages: [                                  // poori history, frontend bhejta hai
    { role: "user",      parts: [{ type: "text", text: "Rust kya hai?" }] },
    { role: "assistant", parts: [{ type: "text", text: "Rust ek systems..." }] },
    { role: "user",      parts: [{ type: "text", text: "Ownership kya hai?" }] },
  ],
  model: "gpt-4o",
  webSearch: false,
})
```

Dhyaan do: `res` (Express response) function ko **pass kiya ja raha hai**, return nahi ho raha. Kyunki ye streaming endpoint hai — jawab thoda-thoda karke jaayega, ek baar mein nahi.

---

## Phase 1 — Validation aur setup (line 228-237)

```ts
const workspace = await getWorkspaceByIdForUser(workspaceId, userId);
```

**Sabse pehle security.** Ye check karta hai ki `user_42` ka `ws_01` par haq hai ya nahi. Nahi hua to yahi throw ho jaata hai — aage ka koi kaam nahi hota. Har chat request pe ye ownership check chalta hai.

```ts
const requestedModel = input.model ?? workspace.defaultModel;
const chatModel = CHAT_MODELS.find((model) => model === requestedModel) ?? CHAT_MODEL;
```

Model kaunsa use karna hai, teen level ka fallback:

| Priority | Source | Example |
| --- | --- | --- |
| 1 | client ne bheja | `"gpt-4o"` |
| 2 | workspace ki default setting | `workspace.defaultModel` |
| 3 | global default `CHAT_MODEL` | `"gpt-4o-mini"` |

`CHAT_MODELS.find(...)` **whitelist check** hai ([ai-config.ts:5](../lib/ai-config.ts#L5) mein sirf `gpt-4o-mini` aur `gpt-4o` allowed hain). Agar koi malicious client `model: "gpt-5-super-expensive"` bhej de to `find` `undefined` dega aur `?? CHAT_MODEL` safe default pe gir jaayega. Client ki string kabhi seedhe OpenAI ko nahi jaati.

```ts
const webSearchEnabled = input.webSearch === true && !!process.env.TAVILY_API_KEY?.trim();
```

Do conditions — user ne toggle on kiya **aur** server pe Tavily ki key hai. Dono chahiye. Key nahi hai to user toggle chalu bhi kar de, silently off rahega.

```ts
const userText = getLastUserMessageText(input.messages);
if (!userText) {
    throw new ValidationError("A user message is required");
}
```

`getLastUserMessageText` ([chat-message.ts:22](../utils/chat-message.ts#L22)) array ke **peeche se aage** chalta hai aur pehla non-empty user message dhundta hai. Humare example mein → `"Ownership kya hai?"`.

Peeche se kyun? Kyunki array mein purane user messages bhi hain — humein **abhi wala** sawaal chahiye, pehla wala nahi.

## Phase 2 — Conversation resolve aur user message save (line 239-250)

```ts
const conversation = await resolveConversation(workspaceId, input.conversationId, userText);
```

[resolveConversation](./chat.service.ts#L173) ke do raaste:

- **`conversationId` aaya** (humara case) → DB se `conv_77` load karo. Na mile to `NotFoundError`. Ye bhi ek security check hai — conversation usi workspace ka hona chahiye.
- **`conversationId` nahi aaya** (bilkul naya chat) → nayi conversation banao, aur title auto-generate karo user ke pehle message se (`buildConversationTitle` 72 chars pe kaat deta hai).

```ts
await createMessageRecord({
    conversationId: conversation.id,
    role: "USER",
    content: userText,
});
```

User ka message **abhi save ho gaya**, LLM ke jawab dene se pehle. Isliye ki agar aage koi bhi cheez fail ho jaaye — OpenAI down ho, user tab band kar de — to user ka sawaal DB mein safe hai.

Iska side effect ye hai ki fail hone par ek "orphan" user message reh jaata hai jiska koi jawab nahi. Refresh karne pe wo dikhega. Trade-off deliberate hai: message kho jaane se behtar hai adhoora dikhna.

## Phase 3 — RAG + Memory, dono ek sath (line 252-255)

```ts
const [retrievedChunks, userMemories] = await Promise.all([
    retrieveWorkspaceContext(workspaceId, userText),   // Pinecone
    searchUserMemories(userId, userText),              // Mem0
]);
```

Ye function ka sabse important optimization hai. **`Promise.all`** dono ko parallel chalata hai:

```
Sequential hota to:     [Pinecone 300ms] → [Mem0 250ms]  = 550ms
Promise.all se:         [Pinecone 300ms]                  = 300ms
                        [Mem0 250ms]
```

Dono independent hain — Mem0 ko Pinecone ke result ki zaroorat nahi. Isliye wait karwane ka koi matlab nahi.

Andar kya hota hai:

**`retrieveWorkspaceContext`** ([retrieve.ts:33](../lib/rag/retrieve.ts#L33)):
1. `"Ownership kya hai?"` ko embed karo (same `text-embedding-3-small` model jo indexing mein use hua tha — dono taraf same model hona zaroori hai)
2. `ws_01` namespace mein Pinecone se top 6 (`RAG_TOP_K`) chunks
3. Jinka score `0.35` (`RAG_MIN_SCORE`) se kam hai unhe **hata do**

Wo `RAG_MIN_SCORE` filter ekdum kaam ka hai. Agar user *"aaj mausam kaisa hai?"* pooche to Rust book se koi bhi chunk relevant nahi hoga — sabke score kam honge, sab filter ho jaayenge, aur `chunks = []`. Phir prompt builder khud bol deta hai "nothing relevant was retrieved, general knowledge se jawab do". Isse **kachra context** LLM tak nahi pahunchta.

Humare case mein wapas aaye:

```js
retrievedChunks = [
  { sourceTitle: "Rust Book", sourceType: "PDF", chunkId: "chk_88",
    page: 47, text: "Ownership is Rust's most unique feature...", score: 0.89 },
  { sourceTitle: "Rust Book", ..., page: 48, text: "Each value has an owner...", score: 0.81 },
]

userMemories = [ { memory: "User is a beginner programmer" }, { memory: "User knows Python" } ]
```

## Phase 4 — Citations aur system prompt (line 257-271)

```ts
const citations = retrievedChunks.map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    ...
    excerpt: chunk.text.slice(0, 280),
    score: chunk.score,
}));
```

`citations` **abhi** bana liya, jabki iska use bahut baad mein `onFinish` ke andar hoga. Ye **closure** ka use hai — `onFinish` ek arrow function hai jo isi scope mein define hua hai, to wo `citations` ko baad mein bhi padh sakta hai. Isse `onFinish` ko dobara Pinecone query nahi karni padti.

```ts
const systemPrompt = buildChatSystemPrompt({
    chunks: retrievedChunks,
    conversationSummary: conversation.summary,
    userMemories: userMemories.map((memory) => memory.memory),
    webSearchEnabled,
});
```

Chaar cheezein ek bade prompt string mein ghul jaati hain ([retrieve.ts:93](../lib/rag/retrieve.ts#L93)):

```
You are Chaibook, an assistant that helps users learn from their workspace sources.

Known facts about this user (use when relevant):
- User is a beginner programmer
- User knows Python

Earlier conversation summary:
User Rust seekh raha hai, syntax basics discuss kiye...

[1] Rust Book (PDF) page 47
Ownership is Rust's most unique feature...

[2] Rust Book (PDF) page 48
Each value has an owner...
```

`[1]`, `[2]` numbering deliberate hai — LLM ko bola jaata hai inhi numbers se cite karo, aur frontend un numbers ko `citations` array se match karke clickable source card bana deta hai.

## Phase 5 — Context window trim (line 273-277)

```ts
const contextMessages =
    conversation.summary && input.messages.length > RECENT_MESSAGE_WINDOW
        ? input.messages.slice(-RECENT_MESSAGE_WINDOW)
        : input.messages;
```

Ye token bachane ka logic hai. `RECENT_MESSAGE_WINDOW = 12`.

| Situation | Kya bhejenge |
| --- | --- |
| 5 messages hain | sab 5 |
| 40 messages, par summary **nahi** bani | sab 40 |
| 40 messages **aur** summary bani hui hai | last 12 + summary (prompt mein) |

Dono conditions zaroori kyun hain? Kyunki agar summary nahi bani aur hum phir bhi purane messages kaat dete, to wo history **hamesha ke liye kho jaati**. Summary hone ka matlab hai purani baatein already prompt mein compress hoke maujood hain — tabhi kaatna safe hai.

100-message conversation mein ye har request pe hazaaron token bachata hai.

## Phase 6 — Streaming (line 279-321)

```ts
let webSearchResults: TavilySearchResponse | null = null;

const stream = createUIMessageStream({
    originalMessages: input.messages,
    execute: async ({ writer }) => { ... },
    onFinish: async ({ responseMessage, isAborted }) => { ... },
});
```

`webSearchResults` ko `let` se **bahar** declare kiya gaya hai. Kyun? Kyunki ise **tool ke andar likha** jaata hai aur **`onFinish` mein padha** jaata hai — do alag callbacks. Bahar declare karne se dono usi variable ko share karte hain (phir wahi closure trick).

### `execute` — yahan actual LLM call hoti hai

```ts
const tools = webSearchEnabled ? {
    web_search: tool({
        description: "Search the web for up-to-date information outside the workspace sources.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
            const results = await searchWeb(query);
            webSearchResults = results;              // ← bahar wale variable mein bhar diya
            return formatTavilyResultsForPrompt(results);
        },
    }),
} : undefined;
```

Ye **tool calling** hai. Hum khud web search nahi karte — hum LLM ko ek tool "de" dete hain aur LLM khud decide karta hai use chalana hai ya nahi.

`description` aur `inputSchema` sirf humare liye nahi hain — ye **LLM ko bheje jaate hain** taaki wo samajh sake ye tool kab aur kaise use karna hai. Isliye description clear likhna zaroori hai.

```ts
const result = streamText({
    model: openai(chatModel),
    system: systemPrompt,
    messages: await convertToModelMessages(contextMessages),
    tools,
    stopWhen: webSearchEnabled ? isStepCount(3) : undefined,
});

writer.merge(toUIMessageStream({ stream: result.stream }));
```

`convertToModelMessages` UI format (`parts` array wala) ko OpenAI ke format mein badalta hai.

**`stopWhen: isStepCount(3)` ka matlab** — jab tool ho, to ek reply mein multiple round-trips hote hain:

```
Step 1: LLM bolta hai "mujhe web_search chahiye, query: rust 2024 updates"
Step 2: hum tool chalate hain, result LLM ko wapas dete hain
Step 3: LLM ab actual jawab likhta hai
```

Bina limit ke LLM infinite loop mein tool call karta reh sakta hai (aur har call paisa lagti hai). `isStepCount(3)` safety brake hai. Web search off ho to `undefined` — koi tool hi nahi, to loop ka sawaal hi nahi.

`writer.merge(...)` — LLM ka output token-by-token stream mein daal deta hai. **Yahi wo moment hai jab user ko screen pe text type hota dikhna shuru hota hai**, jabki neeche ka `onFinish` abhi chala bhi nahi.

### `onFinish` — stream khatam hone ke baad ka cleanup

```ts
onFinish: async ({ responseMessage, isAborted }) => {
    if (isAborted) return;

    const assistantText = getTextFromUIMessage(responseMessage).trim();
    if (!assistantText) return;
```

Do early exits. `isAborted` = user ne beech mein "Stop" dabaya ya tab band kar diya — to adhoora jawab save mat karo. `!assistantText` = LLM ne khaali reply diya (sirf tool call kiya, text nahi) — khaali row save karne ka koi faayda nahi.

Iske baad **6 kaam** hote hain, ek-ek karke:

**1. Web citations jodo**

```ts
const webCitations = webSearchResults
    ? webSearchResults.results.map((result) => ({
          sourceType: "WEB" as const, sourceTitle: result.title,
          url: result.url, excerpt: result.content.slice(0, 280),
      }))
    : [];
const allCitations = [...citations, ...webCitations];
```

Ab wo bahar wala `webSearchResults` variable kaam aata hai. Document citations (Phase 4 se) + web citations = ek hi array. Frontend dono ko ek jaisa render kar sakta hai.

**2. Assistant message save karo**

```ts
await createMessageRecord({
    conversationId: conversation.id, role: "ASSISTANT",
    content: assistantText, citations: allCitations,
});
```

**3. Conversation ko "touch" karo** — `touchConversation` `updatedAt` update karta hai, jisse sidebar mein ye chat sabse upar aa jaati hai.

**4. Title set karo agar nahi hai**

```ts
if (!conversation.title) {
    await updateConversationRecord(conversation.id, { title: buildConversationTitle(userText) });
}
```

Note: `resolveConversation` naye chat ka title pehle hi set kar deta hai. To ye branch sirf tab chalti hai jab conversation **explicit "New chat" button** se bani thi (`createConversationForWorkspace` bina title ke) — us waqt title `null` reh jaata hai, aur pehla message aane par yahan bhar jaata hai.

**5. Summary job enqueue karo**

```ts
const messageCount = await countMessagesByConversationId(conversation.id);
if (messageCount % CONVERSATION_SUMMARY_INTERVAL === 0) {
    await enqueueConversationSummarize({ conversationId: conversation.id, userId });
}
```

`CONVERSATION_SUMMARY_INTERVAL = 8`. Har turn mein 2 messages save hote hain (user + assistant), to count hamesha even rehta hai: 2, 4, 6, **8** ← yahan job chalti hai, phir 10, 12, 14, **16**...

Matlab har **4 turn** baad. Job Inngest ko jaati hai — HTTP request block nahi hoti.

**6. Mem0 ko sikhao**

```ts
void addMemoriesFromMessages(userId, [
    { role: "user", content: userText },
    { role: "assistant", content: assistantText },
], { source: "learned", conversationId: conversation.id })
.catch((error) => { console.error("Mem0 add failed:", error); });
```

`void` keyword = **fire-and-forget**. Iska `await` nahi kar rahe. Kyun? Kyunki user ka jawab already screen pe aa chuka hai — usse Mem0 ke liye extra 500ms rukwane ka koi faayda nahi.

`.catch(...)` bhi zaroori hai: `void` ke sath agar promise reject ho jaaye aur catch na ho, to Node.js mein **unhandled rejection** ho jaayega — kuch versions mein process hi crash kar sakta hai. Yahan bas log hota hai. Mem0 fail hona chat ko todna nahi chahiye — ye "nice to have" feature hai, critical path nahi.

## Phase 7 — Response bhejo (line 380-386)

```ts
await pipeUIMessageStreamToResponse({
    response: res,
    stream,
    headers: { "X-Conversation-Id": conversation.id },
});
```

Stream ko Express response se jod deta hai.

**`X-Conversation-Id` header kyun?** Kyunki agar ye bilkul naya chat tha, to client ke paas `conversationId` tha hi nahi — humne server pe banaya. Response body ek stream hai (JSON nahi), to id header mein bhejni padti hai. Client use padh ke apne state mein save kar leta hai, taaki agla message usi conversation mein jaaye.

---

## Poora timeline

```
t=0ms     ┌─ Workspace ownership check
          ├─ Model whitelist + webSearch flag
          ├─ getLastUserMessageText  → "Ownership kya hai?"
t=50ms    ├─ resolveConversation     → conv_77 DB se
t=90ms    ├─ USER message save       ← ab safe hai
          │
t=90ms    ├─ Promise.all ────┬─ Pinecone: 2 chunks (score 0.89, 0.81)
          │                  └─ Mem0:     2 memories
t=390ms   ├─ ←───────────────┘  (dono khatam, 550ms nahi 300ms lage)
          │
          ├─ citations array banao   (onFinish ke liye closure mein)
          ├─ buildChatSystemPrompt   (chunks + memories + summary)
          ├─ contextMessages trim    (12 se zyada ho to hi)
          │
t=400ms   ├─ streamText → OpenAI
t=700ms   ├─ pehla token user ki screen pe  ◄── USER KO YAHAN SE DIKHNA SHURU
   ...    ├─ tokens behte rahe...
t=4000ms  ├─ stream khatam
          │
          └─ onFinish:
               1. web citations merge
               2. ASSISTANT message + citations save
               3. touchConversation (sidebar ordering)
               4. title (agar missing)
               5. count % 8 === 0 → Inngest summary job
               6. void Mem0 learn  ← await nahi
```

## Teen cheezein jo yaad rakhne layak hain

**1. Do alag "save" points** — user message stream se **pehle**, assistant message stream ke **baad**. Isse crash hone par bhi sawaal nahi khota.

**2. Closure har jagah use hua hai** — `citations` aur `webSearchResults` bahar declare hote hain, andar callbacks unhe padhte/likhte hain. Isse `onFinish` ko koi data dobara fetch nahi karna padta.

**3. Blocking vs non-blocking ka soch-samajh ke faisla** —

| Kaam | Blocking? | Kyun |
| --- | --- | --- |
| Ownership check | `await` | security, pehle hona hi chahiye |
| RAG + Memory | `await` (par parallel) | inke bina prompt ban hi nahi sakta |
| Message save | `await` | data kho nahi sakta |
| Summary | Inngest queue | LLM call hai, slow, turant chahiye nahi |
| Mem0 learn | `void` | best-effort, fail hona chalega |
