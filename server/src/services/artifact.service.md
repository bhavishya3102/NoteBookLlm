# `createArtifactForWorkspace` + `processArtifactById` — flow example ke sath

Ye dono functions milke ek hi kaam karte hain — user ke sources se **learning artifact** (quiz, flashcards, summary, mindmap...) banana. Par ye **jaan-boojh kar do hisson mein toda gaya hai**.

## Pehle samjho: ek hi function kyun nahi?

AI se quiz generate karne mein **8-15 second** lag jaate hain. Agar ye seedha HTTP request mein karte to:

```
User "Generate Quiz" dabata hai
  → browser 15 second tak spinner ghumata rahega
  → ho sakta hai proxy/load-balancer 30s pe timeout kar de
  → user tab band kar de to poora kaam bekaar
  → server ka ek connection 15 second block
```

Isliye kaam **do tukdon** mein baanta gaya hai:

| | `createArtifactForWorkspace` | `processArtifactById` |
| --- | --- | --- |
| Kahan chalta hai | HTTP request ke andar | Inngest background worker |
| Kitna time | ~150ms | 8-15 second |
| User wait karta hai | haan | nahi |
| Kaam | row banao, job enqueue karo | AI se content banwao |
| Return | `PENDING` artifact | `READY` artifact |

Ye pattern **"fast ack, slow work"** kehlata hai. Same pattern source processing mein bhi use hua hai ([source-processing.service.md](./source-processing.service.md)).

---

# Part 1 — `createArtifactForWorkspace`

## Setup — request kya aati hai

User **"Rust Book"** workspace mein hai, 3 sources hain, aur usne "Generate Quiz" button dabaya:

```js
createArtifactForWorkspace("ws_01", "user_42", {
  type: "QUIZ",
  sourceIds: ["src_99", "src_100"],   // user ne 3 mein se 2 select kiye
  // title diya hi nahi — auto-generate hoga
})
```

## Step 1 — Ownership check (line 83)

```ts
await getWorkspaceByIdForUser(workspaceId, userId);
```

Pehla kaam hamesha security. `user_42` ka `ws_01` par haq hai? Nahi to yahi throw. Return value use hi nahi ho raha — sirf side effect (throw) ke liye call kiya gaya hai.

## Step 2 — Sources gather karo (line 85-88)

```ts
const context = await gatherSourceContext(workspaceId, input.sourceIds);
```

[gatherSourceContext](./artifact-generation.service.ts#L81) ke andar 4 kaam:

**1. Sirf READY sources lo**

```ts
const sources = await findSourcesByWorkspaceId(workspaceId, { status: "READY" });
```

`PENDING`/`PROCESSING`/`FAILED` sources chhod diye jaate hain — unka text abhi extract hi nahi hua.

**2. User ki selection filter karo**

```ts
const selected = sourceIds?.length
    ? sources.filter((source) => sourceIds.includes(source.id))
    : sources;
```

`sourceIds` diya to sirf wo, nahi diya to **poore workspace ke sab** READY sources. Frontend "Selected sources" aur "All sources" dono option de sakta hai.

**3. Do alag validation errors**

```ts
if (selected.length === 0) {
    throw new ValidationError("No ready sources found. Add and process sources before generating learning tools.");
}
// ...
if (withContent.length === 0) {
    throw new ValidationError("Selected sources have no extracted content yet.");
}
```

Do alag message kyun? Kyunki do alag problem hain, aur user ko alag action lena hai:

| Case | Kya hua | User kya kare |
| --- | --- | --- |
| `selected.length === 0` | koi READY source hi nahi | source upload karo / process hone do |
| `withContent.length === 0` | READY to hain par `content` khaali | source corrupt hai, re-process karo |

**4. Sab text jodo**

```ts
const text = withContent
    .map((source) => `# ${source.title}\n\n${source.content}`)
    .join("\n\n---\n\n")
    .slice(0, MAX_CONTEXT_CHARS);   // 120_000
```

Result kuch aisa:

```
# Rust Book

Ownership is Rust's most unique feature...

---

# Async Rust Guide

Futures in Rust are lazy...
```

`# title` aur `---` separator isliye ki **LLM ko pata chale kahan ek document khatam hua aur doosra shuru**. Bina iske sab text ek ghol ban jaata.

`slice(0, 120_000)` — roughly 30k tokens. GPT-4o-mini ki limit se kam, taaki request reject na ho.

Wapas milta hai:

```js
context = {
  text: "# Rust Book\n\nOwnership is...",   // ~85,000 chars
  sourceIds: ["src_99", "src_100"],
}
```

## Step 3 — Artifact row banao (line 90-107)

```ts
const artifact = await createArtifactRecord({
    workspaceId,
    type: input.type,
    title: input.title || `${ { SUMMARY: "Summary", TAKEAWAYS: "Key Takeaways",
        FLASHCARDS: "Flashcards", QUIZ: "Quiz", MINDMAP: "Mind Map",
        REPORT: "AI Report" }[input.type] } · ${new Date().toLocaleDateString()}`,
    sourceIds: context.sourceIds,
    status: "PENDING",
});
```

**Title ka trick:** ye ek **object literal banake usi waqt index karna** hai. `{...}[input.type]` — object banta hai, aur turant usme se `"QUIZ"` key nikal li jaati hai → `"Quiz"`. Ye switch-case ka chhota version hai. Result:

```
"Quiz · 15/8/2026"
```

Ek chhoti baat: `new Date().toLocaleDateString()` **server ki locale** use karta hai, user ki nahi. To India ke user ko bhi US server pe `8/15/2026` dikhega. Choti si cosmetic baat hai.

**`sourceIds: context.sourceIds`** — dhyaan do, `input.sourceIds` nahi, `context.sourceIds`. Fark ye hai:

```js
input.sourceIds   = ["src_99", "src_100", "src_101"]   // user ne 3 maange
context.sourceIds = ["src_99", "src_100"]              // par src_101 abhi PROCESSING tha
```

Jo actually use hue **wahi** save hote hain. Isse baad mein pata rehta hai ye artifact kis exact material se bana tha.

**`status: "PENDING"`** — row ban gayi par content abhi `null` hai.

## Step 4 — Job queue mein daalo (line 109-112)

```ts
await enqueueArtifactGeneration({ artifactId: artifact.id, workspaceId });
```

Ye Inngest ko ek event bhejta hai ([artifact-events.ts](../lib/artifact-events.ts)):

```ts
await inngest.send({ name: "artifact/generate", data: input });
```

Bas event bhej diya — kaam yahin khatam. Inngest ise apni queue mein rakhta hai aur alag se worker chalata hai.

## Step 5 — Turant return (line 114)

```ts
return artifact;
```

User ko milta hai:

```json
{ "id": "art_55", "type": "QUIZ", "title": "Quiz · 15/8/2026",
  "status": "PENDING", "content": null, "sourceIds": ["src_99", "src_100"] }
```

Total time: **~150ms**. Frontend `status: "PENDING"` dekh ke spinner card dikha deta hai aur poll karna shuru kar deta hai.

---

# Part 2 — `processArtifactById`

Ye ab **alag process** mein chal raha hai. Trigger [inngest/index.ts:65](../inngest/index.ts#L65) se:

```ts
export const generateArtifact = inngest.createFunction(
    { id: "generate-artifact", retries: 2, triggers: [{ event: "artifact/generate" }] },
    async ({ event, step }) => {
        const { artifactId } = event.data;
        await step.run("generate", () => processArtifactById(artifactId));
        return { artifactId, status: "READY" };
    },
);
```

`retries: 2` yaad rakhna — aage important hai.

## Step 1 — Artifact load karo (line 153-156)

```ts
const artifact = await findArtifactById(artifactId);
if (!artifact) {
    throw new Error("Artifact not found");
}
```

Dhyaan do: yahan **`userId` nahi hai, ownership check nahi hai**. Kyun? Kyunki ye function HTTP se reachable hi nahi — sirf Inngest worker ise call karta hai, aur Inngest ko wahi `artifactId` mila jo humne khud Step 4 mein bheja tha. Permission check pehle hi ho chuka hai. Ek cheez ka do baar check karna faltu hai.

Aur `findArtifactById` (not `...AndWorkspaceId`) isliye ki workspace scope ki zaroorat nahi.

## Step 2 — PROCESSING mark karo (line 158)

```ts
await updateArtifactRecord(artifactId, { status: "PROCESSING" });
```

Ye **try block ke bahar** hai, jaan-boojh kar. Ye status user ke liye hai — frontend poll karke `PENDING` → `PROCESSING` dekhta hai, aur "Queued" se "Generating..." message badal deta hai. User ko pata chalta hai kaam sach mein chal raha hai, atka nahi hai.

## Step 3 — Context dobara gather karo (line 161-164)

```ts
const context = await gatherSourceContext(artifact.workspaceId, artifact.sourceIds);
```

**Ruko — ye to `createArtifactForWorkspace` mein already ho chuka tha!** Dobara kyun?

Kyunki dono call ka **maksad alag** hai:

| | Create waala call | Process waala call |
| --- | --- | --- |
| Kya use hota hai | sirf `context.sourceIds` | sirf `context.text` |
| Maksad | **fail fast** + kaunse sources valid hain | actual material chahiye |
| `context.text` ka kya | phenk diya jaata hai | LLM ko jaata hai |

Create waale call ka asli faayda ye hai ki agar koi source ready nahi hai to user ko **turant** error mile — na ki 10 second baad ek FAILED artifact card ke roop mein. Fail fast.

Aur text ko queue mein bhejna practical bhi nahi — 120,000 chars ka payload har event mein? Bekaar. `artifactId` bhej do, worker khud DB se padh lega.

Ek din mein hone wala side effect: dono calls ke beech mein agar koi source delete ho gaya, to `artifact.sourceIds` mein wo id hogi par `gatherSourceContext` ka filter use chhod dega — content thoda kam ho jaayega, par crash nahi hoga.

## Step 4 — AI se content banwao (line 166-169)

```ts
const content = await generateArtifactContent(artifact.type, context.text);
```

[generateArtifactContent](./artifact-generation.service.ts#L132) ek `switch` hai jo type ke hisaab se alag prompt aur alag **output schema** use karta hai.

Sabse pehle common system prompt:

```ts
const system = [
    `You are Manthan, an expert learning assistant generating a ${type.toLowerCase()} from workspace source materials.`,
    "Use ONLY the provided source content. Do not invent facts not supported by the sources.",
    "Be clear, educational, and well-structured.",
].join("\n");
```

Wo *"Use ONLY the provided source content"* line **anti-hallucination guard** hai. Bina iske LLM apni general knowledge se Rust ke sawaal bana dega jo user ki book mein hain hi nahi.

Phir `QUIZ` case:

```ts
case "QUIZ": {
    const result = await generateText({
        model: openai(CHAT_MODEL),
        system,
        output: Output.object({ schema: quizSchema }),
        prompt: `Create a multiple-choice quiz with explanations from:\n\n${sourceText}`,
    });
    return result.output;
}
```

**`Output.object({ schema })` sabse important hissa hai.** Ye LLM ko free-form text likhne hi nahi deta — output ko Zod schema mein force karta hai:

```ts
const quizSchema = z.object({
    questions: z.array(z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(5),
        correctIndex: z.number().int().min(0),
        explanation: z.string(),
    })).min(3).max(15),
});
```

Milta hai ready-to-render JSON:

```json
{ "questions": [
    { "question": "Rust mein har value ke kitne owners ho sakte hain?",
      "options": ["Ek", "Do", "Unlimited", "Zero"],
      "correctIndex": 0,
      "explanation": "Rust ownership rules ke hisaab se har value ka exactly ek owner hota hai." }
] }
```

Frontend ko parse karne ki zaroorat nahi, na regex, na "hopefully LLM ne sahi format diya hoga" wali dua. Aur `.min(3).max(15)` ke wajah se LLM 1 sawaal ya 200 sawaal nahi de sakta.

**`SUMMARY` sabse alag hai** — usme `output` hai hi nahi:

```ts
case "SUMMARY": {
    const result = await generateText({ model: openai(CHAT_MODEL), system, prompt: `...` });
    return { markdown: result.text };
}
```

Kyunki summary to bas free-flowing markdown hai — usme structure thopne ka koi faayda nahi. Isliye `result.output` nahi, `result.text` use hota hai aur khud `{ markdown }` mein wrap kar dete hain — taaki DB mein sab artifacts ka shape consistent rahe (hamesha ek JSON object).

## Step 5 — READY mark karo (line 171-178)

```ts
return updateArtifactRecord(artifactId, {
    status: "READY",
    content: content as Prisma.InputJsonValue,
    metadata: {
        generatedAt: new Date().toISOString(),
        processingError: undefined,
    },
});
```

`processingError: undefined` **jaan-boojh kar** hai. Socho: pehli baar generation fail hua, `processingError: "OpenAI rate limit"` set ho gaya. Ab Inngest retry karta hai aur is baar safal ho jaata hai. Agar ye line na hoti to purana error message metadata mein pada reh jaata aur UI galat error dikhata rehta. Ye **purana error saaf** karta hai.

## Step 6 — Error handling (line 179-193)

```ts
} catch (error) {
    const message = error instanceof Error ? error.message : "Artifact generation failed";

    await updateArtifactRecord(artifactId, {
        status: "FAILED",
        metadata: { processingError: message },
    });

    throw error;
}
```

Yahan teen cheezein ho rahi hain:

**1. `error instanceof Error` check** — JavaScript mein koi bhi cheez throw ho sakti hai (`throw "oops"`, `throw 42`). Agar seedha `error.message` padhte to string throw hone par `undefined` milta. Ye check safe fallback deta hai.

**2. FAILED status + error message save** — taaki user ko card pe actual reason dikhe ("OpenAI rate limit exceeded"), na ki khaali "Failed".

**3. `throw error` — sabse important line.** Error catch karke, DB update karke, phir **dobara throw** kyun?

Kyunki Inngest ko batana hai ki job fail hua. Agar throw na karte to Inngest samajhta "job successful" aur `retries: 2` **kabhi trigger hi nahi hota**.

To ye pattern hai: *"error ko record karo (user ke liye), phir uupar pass kar do (retry system ke liye)"*. Isse dono ko wo mil jaata hai jo chahiye.

Retry par kya hota hai — poora function phir se shuru se chalta hai: `PROCESSING` set, context gather, LLM call. Ye **safe** hai kyunki koi bhi step permanent side effect nahi chhodta — bas artifact row overwrite hoti hai. Isliye ise retry karna bilkul theek hai.

---

## Poora timeline

```
── HTTP REQUEST (user wait kar raha hai) ──────────────────────
t=0ms     User "Generate Quiz" dabata hai
          ├─ getWorkspaceByIdForUser        (ownership)
t=40ms    ├─ gatherSourceContext            (validate — fail fast)
          │    └─ text phenk diya, sourceIds rakh liye
t=120ms   ├─ createArtifactRecord           status: PENDING
t=150ms   ├─ enqueueArtifactGeneration      → Inngest
t=155ms   └─ return artifact                ◄── USER FREE, spinner dikh raha
──────────────────────────────────────────────────────────────

── INNGEST WORKER (background) ────────────────────────────────
t=200ms   Event "artifact/generate" pick hua
          ├─ findArtifactById               (koi auth check nahi — zaroorat nahi)
t=250ms   ├─ status: PROCESSING             ◄── UI "Generating..." dikhata hai
t=300ms   ├─ gatherSourceContext            (ab text chahiye — 85k chars)
          │
t=400ms   ├─ generateArtifactContent → OpenAI
          │    Output.object({ quizSchema })
t=9000ms  ├─ ← 8 structured questions wapas
          │
t=9100ms  └─ status: READY + content        ◄── UI quiz render karta hai
──────────────────────────────────────────────────────────────

    Fail hone par:  status: FAILED + processingError
                    throw error → Inngest retry (max 2 baar)
```

## Status ka safar

```
PENDING ──► PROCESSING ──► READY
                 │
                 └──────► FAILED ──► (retry) ──► PROCESSING ──► READY
```

Har status ka ek user-facing matlab hai:

| Status | UI kya dikhata hai |
| --- | --- |
| `PENDING` | "Queued..." — job queue mein hai |
| `PROCESSING` | "Generating..." — worker chal raha hai |
| `READY` | actual quiz/flashcards |
| `FAILED` | error message + Retry button |

## Paanch cheezein yaad rakhne layak

**1. Fast ack, slow work** — 150ms mein `PENDING` return, asli kaam background mein. User kabhi 15 second wait nahi karta.

**2. `gatherSourceContext` do baar, dono baar alag maksad** — create mein validate karne ke liye (fail fast), process mein actual text ke liye.

**3. Auth sirf entry point pe** — `processArtifactById` mein koi permission check nahi, kyunki wo HTTP se reachable hi nahi hai.

**4. `Output.object({ schema })` structured output ki guarantee deta hai** — LLM ka jawab Zod schema mein force ho jaata hai, frontend ko parsing/validation nahi karni padti.

**5. `throw error` catch ke baad zaroori hai** — bina iske Inngest ka `retries: 2` kabhi chalega hi nahi.
