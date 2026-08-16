# Memory (Mem0) — kya hai aur kis liye hai

## Problem kya hai — memory kyun chahiye

LLM **stateless** hota hai. Har API call ek naya banda hai jise kuch yaad nahi. Aap aaj bolo "main beginner hoon, Hindi mein samjhao" — kal naye chat mein wo phir se PhD-level English mein jawab dega.

Is app mein **teen alag-alag** memory layers hain, teeno ka kaam alag hai:

| Layer | Kahan store | Kya store karta | Scope |
| --- | --- | --- | --- |
| **RAG** (Pinecone) | vectors | *documents* mein kya likha hai | ek workspace |
| **Conversation summary** (Postgres) | text | *is chat* mein ab tak kya baat hui | ek conversation |
| **Mem0 memory** | Mem0 cloud | *user ke baare mein* facts | poora user, sab chats |

Aapka sawaal teesri wali layer ka hai. Fark ye hai — RAG batata hai "book mein kya hai", Mem0 batata hai **"user kaun hai"**. Ye chat badalne par bhi zinda rehti hai.

## Memory banti kaise hai — do raaste

### Raasta 1 — Manual (aapka selected code)

```js
// memory.service.ts:16
export function createMemoryForUser(userId, input) {
    return addUserMemory(userId, {
        memory: input.memory,
        infer: false,                      // ← ye line sabse important hai
        metadata: { source: "manual" },
    });
}
```

User UI mein khud type karta hai: *"Main JavaScript beginner hoon, C++ nahi jaanta"* → ye seedha as-is store ho jaata hai.

**`infer: false` ka matlab:** Mem0 ko bolo "isme dimaag mat lagao, jo diya hai wahi jaise ka waise save kar do."

### Raasta 2 — Learned (automatic)

[chat.service.ts:363](./chat.service.ts#L363) — har chat reply ke baad, background mein:

```js
void addMemoriesFromMessages(userId, [
    { role: "user", content: userText },
    { role: "assistant", content: assistantText },
], { source: "learned", conversationId });
```

Aur iske andar ([mem0.ts](../lib/mem0.ts)) `infer: true` hai — yahan Mem0 **khud** conversation padh ke facts nikaalta hai.

### `infer: false` vs `infer: true` — example se

Maano user ne likha: *"yaar main abhi college 2nd year mein hoon aur mujhe Python aata hai par Rust bilkul naya hai, isliye analogies ke saath samjhao"*

| | `infer: false` (manual) | `infer: true` (learned) |
| --- | --- | --- |
| Mem0 kya store karega | poori line jaise ki waise, ek hi memory | LLM se todwa ke 3 alag facts |
| Result | `"yaar main abhi college 2nd year mein hoon aur..."` | `"User is a 2nd year college student"`<br>`"User knows Python, new to Rust"`<br>`"User prefers explanations with analogies"` |

`infer: true` mein Mem0 andar-hi-andar ek LLM chalata hai jo fluff hata ke saaf-suthre facts banata hai, aur purani contradicting memory ho to update bhi kar deta hai. Isliye chat se aane wale messy text ke liye `true`, aur user ke apne likhe hue precise text ke liye `false` — usme AI ko chhedchhad nahi karni chahiye.

## Poora flow — ek real example

**Din 1, "Rust Book" workspace mein:**

```
User: "Ownership samjhao"
```

[chat.service.ts:252](./chat.service.ts#L252) — do cheezein **parallel** chalti hain:

```js
const [retrievedChunks, userMemories] = await Promise.all([
    retrieveWorkspaceContext(workspaceId, userText),  // Pinecone: book se ownership wale chunks
    searchUserMemories(userId, userText),             // Mem0: user ke baare mein kuch pata hai?
]);
```

Pehli baar hai → `userMemories = []`. Bot generic jawab deta hai.

User reply karta hai: *"bhai ye samajh nahi aaya, main abhi seekh raha hoon, Python jaanta hoon"*

Reply ke baad line 363 chalti hai (`void` = fire-and-forget, user ko wait nahi karwaate). Mem0 background mein extract karta hai:

```
mem_01: "User is a beginner programmer"     (source: learned)
mem_02: "User knows Python"                 (source: learned)
```

**Din 5, bilkul naya conversation, naya workspace:**

```
User: "Borrow checker kya karta hai?"
```

Ab `searchUserMemories(userId, "Borrow checker kya karta hai?")` chalta hai — ye **semantic search** hai ([mem0.ts:97](../lib/mem0.ts#L97)), keyword match nahi. "Borrow checker" aur "beginner programmer" mein koi common word nahi, phir bhi `threshold: 0.1` itna low hai ki programming-related memories match ho jaati hain. `topK: 8` — max 8 memories.

Wapas aayi: `["User is a beginner programmer", "User knows Python"]`

Phir [retrieve.ts:111](../lib/rag/retrieve.ts#L111) ye system prompt banata hai:

```
You are Chaibook, an assistant that helps users learn from their workspace sources.

Known facts about this user (use when relevant):
- User is a beginner programmer
- User knows Python

Earlier conversation summary:
...

[1] Rust Book (PDF) page 47
The borrow checker enforces...
```

Ab bot ka jawab: *"Python mein aap list pass karte ho to dono variables same object point karte hain, na? Rust ka borrow checker exactly wahi confusion rokta hai..."*

**Ye Python analogy kahan se aayi?** Kisi document mein nahi thi. Mem0 se aayi. Yahi memory ka pura point hai.

## Ek aur cheez — conversation summary bhi memory feed karti hai

[conversation-memory.service.ts](./conversation-memory.service.ts) — har N messages baad Inngest job chalti hai jo:

1. Poori conversation ka rolling summary banati hai (Postgres mein)
2. Last 16 messages Mem0 ko bhejti hai `infer: true` ke sath

To memory do jagah se bharti hai — har message pe (chat.service) aur periodic summarization pe.

## Update wala function

```js
// memory.service.ts:36
export function updateMemoryForUser(_userId, memoryId, input) {
    return updateUserMemory(memoryId, input);
}
```

User UI mein apni memories dekh sakta hai aur galat wali edit kar sakta hai. Jaise Mem0 ne learn kar liya *"User prefers C++"* par actually aapne bas ek baar poocha tha — to edit kar do.

`_userId` par underscore isliye hai kyunki abhi use nahi ho raha. JSDoc mein likha hai *"Reserved for future ownership checks"*. Iska matlab **abhi ownership check nahi hai** — theoretically koi bhi authenticated user kisi aur ki `memoryId` bhej ke uski memory edit kar sakta hai. Jab tak wo check nahi lagta, ye ek chhota security gap hai.

## Summary ek line mein

| Sawaal | Jawab deta hai |
| --- | --- |
| "Book ke page 47 pe kya likha hai?" | RAG / Pinecone |
| "Humne 20 message pehle kya discuss kiya tha?" | Conversation summary |
| "User beginner hai ya expert? Hindi pasand hai?" | **Mem0 memory** |
