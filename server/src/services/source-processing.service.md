# `embedAndIndexSource` — line by line trace

## Setup — input kya aa raha hai

Maan lo user ne ek PDF upload kiya, pipeline ke Step 1 & 2 ho chuke hain. Ab `embedAndIndexSource(source, chunks)` call hua with:

```js
source = {
  id: "src_99",
  workspaceId: "ws_01",
  title: "DSA Notes.pdf",
  type: "PDF",
  metadata: { fileUrl: "...", pageCount: 3 }
}

chunks = [   // Postgres se aaye hue rows (120 total)
  { id: "chk_a", index: 0, content: "Array ek contiguous...", metadata: { page: 1 } },
  { id: "chk_b", index: 1, content: "Linked list mein har node...", metadata: { page: 1 } },
  ...
  { id: "chk_dz", index: 119, content: "Graph traversal...", metadata: { page: 3 } },
]
```

## Line 241-242 — do variables

```ts
const batchSize = 50;                                  // OpenAI ko ek baar mein 50 chunk bhejenge
const records: PineconeRecord<VectorMetadata>[] = [];  // khaali dabba, isme final vectors jama honge
```

`records` abhi `[]` hai. Poore loop ke baad ye 120 items ka array banega.

## Line 244 — bahar wala loop (batching)

```ts
for (let i = 0; i < chunks.length; i += batchSize)
```

120 chunks, step 50 → ye loop **3 baar** chalega:

| iteration | `i` | `chunks.slice(i, i+50)` | batch size |
| --- | --- | --- | --- |
| 1 | 0 | chunks[0..49] | 50 |
| 2 | 50 | chunks[50..99] | 50 |
| 3 | 100 | chunks[100..149] → sirf 120 tak hai | 20 |

Note: `slice` array se aage nahi jaata, isliye last batch automatically 20 ka ban jaata hai — koi extra `Math.min` nahi chahiye.

### Batching kyun?

Agar 120 chunks ek saath OpenAI ko bhej do to request bahut badi ho jaayegi (token limit / payload limit hit). 50 ka batch safe hai.

## Line 245-246 — ek batch ko embed karna

```ts
const batch = chunks.slice(i, i + batchSize);
const embeddings = await embedTexts(batch.map((chunk) => chunk.content));
```

Pehli iteration mein:

```js
batch = [chunk0, chunk1, ..., chunk49]
batch.map(c => c.content) = ["Array ek contiguous...", "Linked list mein...", ...]  // 50 strings
```

`embedTexts` ([openai.ts:31](../lib/openai.ts#L31)) OpenAI ko ek hi API call karta hai aur wapas deta hai:

```js
embeddings = [
  [0.021, -0.113, 0.44, ...],   // 50 numbers nahi — 1536 (ya jo EMBEDDING_DIMENSIONS ho) numbers
  [0.008,  0.239, -0.07, ...],
  ...  // total 50 arrays
]
```

**Sabse important guarantee:** `embedTexts` ke andar `.sort((a,b) => a.index - b.index)` hai. Iska matlab `embeddings[j]` hamesha `batch[j]` ka hi vector hai — order kabhi mismatch nahi hoga. Agar ye sort na hota to chunk A ka text chunk B ke vector se jud sakta tha, aur search totally galat results deta.

## Line 248-250 — andar wala loop (per chunk)

```ts
for (let j = 0; j < batch.length; j += 1) {
    const chunk = batch[j]!;
    const embedding = embeddings[j]!;
```

Ab batch ke andar har chunk pe chalte hain. `j = 1` par:

```js
chunk     = { id: "chk_b", index: 1, content: "Linked list mein har node...", metadata: { page: 1 } }
embedding = [0.008, 0.239, -0.07, ...]
```

`!` (non-null assertion) sirf TypeScript ko bata raha hai "ye undefined nahi hoga" — runtime pe kuch nahi karta.

## Line 251-256 — metadata ko safely padhna

```ts
const chunkMetadata =
    chunk.metadata &&
    typeof chunk.metadata === "object" &&
    !Array.isArray(chunk.metadata)
        ? (chunk.metadata as Record<string, unknown>)
        : {};
```

Ye defensive check hai. `chunk.metadata` Postgres ka **JSON column** hai, to usme kuch bhi ho sakta hai:

| DB mein stored value | check ka result | `chunkMetadata` |
| --- | --- | --- |
| `{ page: 1 }` | object hai, array nahi | `{ page: 1 }` |
| `null` (text source, PDF nahi) | pehli condition fail | `{}` |
| `[1, 2, 3]` | `Array.isArray` true → fail | `{}` |
| `"hello"` | `typeof !== "object"` | `{}` |

`null` ka `typeof` bhi `"object"` hota hai — isliye pehle `chunk.metadata &&` ka truthy check lagaya gaya hai. Aur array bhi object hi hota hai, isliye teesra check. Teeno milke guarantee dete hain ki aage `chunkMetadata.page` padhna safe hai.

## Line 258-273 — Pinecone record banana

```js
records.push({
    id: chunk.id,          // "chk_b"  ← Postgres row id hi Pinecone vector id ban gayi
    values: embedding,     // [0.008, 0.239, ...]
    metadata: {
        workspaceId: "ws_01",
        sourceId: "src_99",
        chunkId: "chk_b",
        chunkIndex: 1,
        sourceTitle: "DSA Notes.pdf",
        sourceType: "PDF",
        text: "Linked list mein har node...",   // 35000 chars tak truncated
        page: 1,
    },
});
```

Teen design decisions yahan chhupe hain:

**1. `id: chunk.id`** — Pinecone vector ki id = Postgres chunk ki id. Isse re-processing idempotent ho jaata hai: same chunk dobara embed hua to upsert purane vector ko *overwrite* karega, duplicate nahi banega.

**2. `text` metadata mein store karna** — ye deliberate denormalization hai. Jab user question puchega, Pinecone search karke top-5 vectors dega, aur unke andar hi actual text mil jaayega. Postgres ko dobara query karne ki zaroorat nahi. `slice(0, 35000)` isliye ki Pinecone ka per-record metadata limit ~40KB hai — usse bada record reject ho jaayega.

**3. Line 269-271 ka conditional spread:**

```ts
...(typeof chunkMetadata.page === "number" ? { page: chunkMetadata.page } : {})
```

Ye "agar page number hai to hi `page` key daalo" wala pattern hai:

- **PDF chunk** → `chunkMetadata.page === 1` → spread hota hai `{ page: 1 }` → metadata mein `page: 1` aa gaya
- **Text/YouTube chunk** → `chunkMetadata.page === undefined` → spread hota hai `{}` → `page` key metadata mein hoti hi nahi

Simple `page: chunkMetadata.page` likhte to text sources ke liye `page: undefined` chala jaata — aur Pinecone `undefined` metadata value accept nahi karta, error deta. Isiliye ye ghumavdaar syntax hai. `VectorMetadata` type mein bhi `page?: number` optional hi hai ([pinecone.ts:103](../lib/pinecone.ts#L103)).

## Loop khatam hone ke baad (line 277)

```ts
await upsertSourceVectors(source.workspaceId, records);  // 120 records
```

Yahan **doosri batching** hoti hai — [pinecone.ts:125](../lib/pinecone.ts#L125) mein 100 ka batch size. To 120 records → 2 network calls (100 + 20), `index.namespace("ws_01")` par.

**Do alag-alag batch sizes kyun?** Kyunki do alag limits hain:

- `50` = OpenAI embedding request limit ke liye
- `100` = Pinecone upsert payload limit ke liye

## Poora flow ek nazar mein

```
120 chunks
   │
   ├─ batch 1 (chunks 0-49)   → 1 OpenAI call → 50 vectors → records.push × 50
   ├─ batch 2 (chunks 50-99)  → 1 OpenAI call → 50 vectors → records.push × 50
   └─ batch 3 (chunks 100-119)→ 1 OpenAI call → 20 vectors → records.push × 20
                                                              │
                                              records = 120 PineconeRecord
                                                              │
                                    upsertSourceVectors("ws_01", records)
                                              ├─ Pinecone upsert (100)
                                              └─ Pinecone upsert (20)
                                                              │
                                    source.status = "READY", chunkCount = 120
```

Total: 3 OpenAI calls + 2 Pinecone calls, bajaye 120 + 120 individual calls ke.

Ek cheez jo yahan sequential hai: batches ek ke baad ek `await` hote hain, parallel nahi. Safe hai (rate limits nahi tootte) par 1000-chunk PDF ke liye slow — 20 sequential OpenAI calls. Agar kabhi speed issue aaye to yahi jagah hai dekhne ki.
