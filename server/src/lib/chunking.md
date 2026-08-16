# Chunking — poora flow, example ke saath

[chunking.ts](./chunking.ts) ek badi text ko chhote-chhote tukdon (chunks) mein todti hai, taaki har tukda alag se embed hokar Pinecone mein jaa sake.

**Chunking kyun?** Kyunki poori 200-page PDF ka ek hi vector banate to wo "average meaning" ban jaata aur kisi bhi sawaal se theek se match nahi karta. Chhote tukde = precise matching + LLM ko sirf relevant hissa bhejna.

**Caller** — [source-processing.service.ts:203](../services/source-processing.service.ts#L203):

```ts
const chunks = pages?.length ? chunkPages(pages) : chunkText(text);
```

PDF ke paas `pages` array hota hai → `chunkPages`; baaki sab (text, URL scrape, YouTube transcript) → `chunkText`.

## Bada picture

```
chunkText(text)                    chunkPages(pages)
[public API]                       [public API — PDF ke liye]
     │                                    │
     │                                    │ har page par alag se
     │                                    └──► chunkText(pageText,
     │                                              { page: N })
     ▼
splitText(text, size, overlap)     ← text ko strings mein toda
     │
     │ SEPARATORS ladder par chalta hai
     ▼
mergeSplits(splits, sep, size)     ← chhote tukdon ko dabbon mein pack kiya
     │
     ▼
["chunk 1", "chunk 2", ...]        → wapas chunkText mein index lagta hai
```

## Step 1 — SEPARATORS ki seedhi (`splitText`)

```ts
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];
```

Sabse "natural" se sabse "aggressive" tak. Idea: paragraph todna acha hai, beech-shabd todna bura. To upar se shuru karo:

```
"\n\n"  paragraph  ──► split hua? HAAN → use karo, break
   │                          NAHI ↓
"\n"    line       ──► split hua? HAAN → use karo, break
   │                          NAHI ↓
". "    sentence   ──► split hua? HAAN → use karo, break
   │                          NAHI ↓
" "     word       ──► split hua? HAAN → use karo, break
   │                          NAHI ↓
""      character  ──► seedha slice (aakhri sahara)
```

**IMPORTANT:** sirf **ek** level use hota hai. Jo pehla separator kaam kar gaya, `break` lag jaata hai — neeche wale kabhi nahi chalte. Ye "recursive" nahi hai: agar ek paragraph 3000 chars ka hai, wo 3000 ka hi chunk banega, usse aage sentence-level par nahi toda jaayega.

## Step 2 — `mergeSplits`: dabbe mein saamaan bharna

Splits mil gaye, par wo bahut chhote ho sakte hain (ek line = 20 chars). Har chhoti line ka alag vector banana bekaar hai. To inhe wapas jodte hain jab tak dabba (`chunkSize`) bhar na jaaye:

```
splits:  [P1] [P2] [P3] [P4] [P5]
           │    │    │    │    │
dabba 1: ┌─────────────┐        │   P1+P2+P3 = 950 chars (1000 se kam)
         │ P1  P2  P3  │        │   P4 daalte to 1200 ho jaata → seal
         └─────────────┘        │
dabba 2:                ┌───────────┐
                        │  P4   P5  │
                        └───────────┘
```

## Pura trace (`chunkSize = 100` rakh ke, taaki chhota dikhe)

**Input text:**

```
Rust Ownership
<khaali line>
Ownership is Rust's most unique feature. It enables memory safety
without a garbage collector.
<khaali line>
Each value has an owner. There can only be one owner at a time.
```

`splitText` → separator `"\n\n"` try kiya → 3 tukde mile (>1, to yahi use hoga):

```
P1 = "Rust Ownership"                  →  14 chars
P2 = "Ownership is Rust's most ..."    →  94 chars
P3 = "Each value has an owner. ..."    →  63 chars
```

`mergeSplits(splits, "\n\n", 100)` ka andar ka hisaab:

| step | split | len | `total+len+sep` | >100? | action |
| --- | --- | --- | --- | --- | --- |
| 1 | P1 | 14 | `0+14+0 = 14` | nahi | `current=[P1]`, `total=14` |
| 2 | P2 | 94 | `14+94+2 = 110` | **HAAN** | seal → `docs=["P1"]`<br>`current=[P2]`, `total=96` |
| 3 | P3 | 63 | `96+63+2 = 161` | **HAAN** | seal → `docs=["P1","P2"]`<br>`current=[P3]`, `total=65` |

Loop khatam → `current` bacha hua hai → `docs=["P1","P2","P3"]`

`chunkText` ab index lagata hai:

```js
[ { index: 0, content: "Rust Ownership" },
  { index: 1, content: "Ownership is Rust's most unique..." },
  { index: 2, content: "Each value has an owner. There..." } ]
```

## Step 3 — Character fallback + overlap (sirf aakhri case)

```ts
for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    chunks.push(text.slice(i, i + chunkSize));
}
```

`size=1000`, `overlap=100` → step = 900:

```
0        900   1000      1800  1900      2700
├─────────┼─────┤          │    │          │
│ chunk 1       │          │    │          │
          ├─────┴──────────┼────┤          │
          │   chunk 2      │    │          │
                           ├────┴──────────┤
                           │   chunk 3     │
                ↑                ↑
             100 char        100 char
             overlap         overlap
```

Overlap isliye ki boundary par kata hua sentence dono chunks mein rahe — warna beech mein kata concept kisi bhi chunk mein poora nahi milta.

**PAR DHYAAN DO:** ye branch tabhi chalti hai jab text mein `"\n\n"` bhi na ho, `"\n"` bhi na ho, `". "` bhi na ho, **aur** `" "` bhi na ho — yaani ek hi lamba shabd (base64 blob / lambi URL). Normal document mein space to hoti hi hai, to `" "` wala separator pehle hi jeet jaata hai aur `break` lag jaata hai. Matlab practice mein chunks ke beech **overlap hota hi nahi**.

## Step 4 — `chunkPages`: PDF ke liye

```
pages = [ "page 1 ka text", "   ", "page 3 ka text" ]
                │             │            │
                ▼             ▼            ▼
         chunkText(...)    khaali →    chunkText(...)
         page: 1           SKIP        page: 3
                │                           │
                ▼                           ▼
         index 0, 1, 2                index 3, 4
                └───────────┬───────────────┘
                            ▼
         [ {index:0, page:1}, {index:1, page:1}, {index:2, page:1},
           {index:3, page:3}, {index:4, page:3} ]
```

Do design decisions:

**1. `page: pageIndex + 1`** — array 0 se ginta hai, PDF reader 1 se. User ko "page 47" dikhana hai, "page 46" nahi. Aur khaali page skip hone par bhi numbering sahi rehti hai, kyunki counter nahi `pageIndex` use hua hai.

**2. `index` global hai** (har page par 0 se reset nahi hota) — poore document mein chunk ka order isi se pata chalta hai.

**Trade-off:** chunk kabhi do pages mein nahi failta. Isliye page 47 ke aakhir mein shuru hua sentence page 48 par kat jaata hai. Badle mein har chunk ka page number 100% sahi hota hai — aur wahi citation mein dikhta hai ("Rust Book, page 47"). Citation accuracy ko continuity par tarjeeh di gayi.

## Dhyaan rakhne laayak baatein

**1. Ek hi separator level use hota hai** — bada paragraph bada chunk hi rahega. 120k char ka ek paragraph aaya to ek hi 120k ka chunk banega.

**2. Overlap practically kabhi apply nahi hota** (upar dekho).

**3. `". "` par todne se beech ke chunks ka aakhri full-stop chala jaata hai** — `"A. B. C"` → `["A","B"]` → `"A. B"`, B ke baad ka `"."` gayab.

**4. `mergeSplits` mein `sepLen` seal hone se pehle calculate hota hai**, to naye dabbe ka `total` separator-length se thoda zyada shuru hota hai. Asar mamooli — chunk 1-2 char kam bhara rehta hai.

**5. [ai-config.ts](./ai-config.ts) mein `CHUNK_SIZE`/`CHUNK_OVERLAP` bhi maujood hain** (wahi 1000/100) par unhe koi use nahi karta — ye file apne `DEFAULT_*` constants use karti hai. `ai-config` waale badalne se chunking par koi farak nahi padega.
