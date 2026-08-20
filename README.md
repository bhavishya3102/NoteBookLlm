<div align="center">

# मंथन · Manthan

**Everything you have read, answering back.**

An AI study workspace that turns your PDFs, lecture videos, websites and notes into
**cited answers, flashcards, quizzes and mind maps** — grounded only in the material
you actually trust.

[**Live app →**](https://manthan-llm-delta.vercel.app) · [Brand & theme spec](./BRAND.md) · [Data model & flow](./DATA-MODEL-AND-FLOW.md) · [Deployment](./DEPLOYMENT.md)

</div>

---

## The problem

A student preparing for an exam is not short of material — they are drowning in it.
A 400-page standard textbook, twelve PDF handouts, a 3-hour recorded lecture, forty
browser tabs, and their own handwritten notes. The bottleneck is not *access* to
information; it is **turning that specific pile into recall**.

Generic chatbots fail here for one reason: **they answer from the internet, not from
your syllabus.** An answer that is 90% right and unattributed is worse than useless
the night before an exam — you cannot verify it, and you cannot cite it.

## What Manthan does

Manthan is a workspace-scoped RAG system. Every answer is retrieved from *your*
sources and carries a clickable citation back to the exact chunk — page number
included for PDFs. From the same indexed material, one click produces the study
artifacts you would otherwise spend a weekend making by hand.

| | |
|---|---|
| **Multi-format ingestion** | PDF (page-aware), any website (Firecrawl), YouTube (transcript), pasted text & markdown |
| **Cited chat** | Streaming answers with `[1] [2]` citations that open the source passage |
| **Learning artifacts** | Summary · Key takeaways · Flashcards · MCQ quiz with explanations · Mind map · Long-form report |
| **Long-term memory** | Mem0-backed user memory — Manthan remembers your goals, exam date, weak topics across sessions |
| **Rolling conversation memory** | Auto-summarises every 8 messages so long threads stay cheap and coherent |
| **Optional web search** | Tavily, per-message toggle, for when the sources genuinely do not cover it |
| **Model choice** | `gpt-4o-mini` by default, `gpt-4o` per workspace or per message |

## Why this is not a NotebookLM clone

1. **Study-loop, not just Q&A.** Ingest → understand → *test yourself*. Quizzes and
   flashcards are first-class objects with their own status lifecycle, not a chat trick.
2. **Persistent user memory.** NotebookLM forgets you between notebooks. Manthan carries
   what it learns about the learner (Mem0) into every workspace.
3. **Background ingestion.** Sources are processed by Inngest jobs, so a 300-page PDF
   does not block the UI and survives a page refresh.
4. **Honest grounding.** Retrieval enforces a similarity floor (`0.35`) — below it, the
   chunk is dropped rather than padded into the prompt to fake an answer.
5. **A design opinion.** "Ink & Amrit" — a Parchment light mode and an Abyss dark mode
   with paper grain, built to look like an archival instrument instead of the default
   purple-gradient AI slop. See [BRAND.md](./BRAND.md).

---

## Architecture

```
                        ┌──────────────────────────────────────┐
   Browser              │  Next.js 15 (App Router) on Vercel   │
   ───────              │  Tailwind v4 · shadcn/ui · Zustand   │
                        │  TanStack Query · AI SDK useChat     │
                        └───────────────┬──────────────────────┘
                                        │ same-origin /api/* rewrites
                                        │ (keeps the auth cookie first-party)
                        ┌───────────────▼──────────────────────┐
                        │  Express 5 + TypeScript on Render     │
                        │  Better Auth (Google OAuth)           │
                        └──┬──────────┬──────────┬──────────┬───┘
                           │          │          │          │
                 ┌─────────▼──┐ ┌─────▼─────┐ ┌──▼──────┐ ┌─▼─────────┐
                 │ Neon       │ │ Pinecone  │ │ Inngest │ │ OpenAI    │
                 │ Postgres   │ │ 1536-dim  │ │ jobs    │ │ chat +    │
                 │ (Prisma 7) │ │ vectors   │ │         │ │ embeddings│
                 └────────────┘ └───────────┘ └────┬────┘ └───────────┘
                                                   │
                          ┌────────────────────────┼───────────────────┐
                          │                        │                   │
                   ┌──────▼──────┐        ┌────────▼───────┐   ┌───────▼──────┐
                   │ Cloudinary  │        │ Firecrawl      │   │ Mem0 · Tavily│
                   │ PDF storage │        │ web scraping   │   │ memory·search│
                   └─────────────┘        └────────────────┘   └──────────────┘
```

### Ingestion pipeline

```
upload / paste URL ──► Source row (PENDING) ──► Inngest event
                                                     │
     extract text ◄───────────────────────────────────┘
     (unpdf · Firecrawl · youtube-transcript)
            │
            ▼
     chunk  ── recursive splitter, separators ["\n\n", "\n", ". ", " ", ""]
            ── 1000 chars, 100 char overlap, page number carried in metadata
            │
            ▼
     embed  ── text-embedding-3-small (1536 dims)
            │
            ▼
     upsert ── Pinecone, namespaced per workspace ──► Source row (READY)
```

### Answer pipeline

```
question ──► ownership check (workspace belongs to this user?)
         ──► embed question
         ──► Pinecone top-6, drop anything scoring < 0.35
         ──► assemble prompt:  system rules
                             + user memories (Mem0)
                             + rolling conversation summary
                             + numbered source chunks  [1] title (PDF, p.42)
                             + optional Tavily results
         ──► stream tokens to the browser (AI SDK)
         ──► persist message + citations, enqueue summary job every 8 messages
```

The full annotated walkthroughs live next to the code:
[`chat.service.md`](./server/src/services/chat.service.md),
[`chunking.md`](./server/src/lib/chunking.md),
[`retrieve.md`](./server/src/lib/rag/retrieve.md),
[`memory.service.md`](./server/src/services/memory.service.md),
[`source-processing.service.md`](./server/src/services/source-processing.service.md).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15, React 19, Tailwind v4, shadcn/ui | App Router + server sessions; rewrites keep auth first-party |
| State | TanStack Query + Zustand | server cache vs. UI state, kept separate |
| Backend | Express 5, TypeScript | small surface, streaming-friendly |
| Auth | Better Auth + Google OAuth | cookie sessions, no token juggling in the client |
| DB | Neon Postgres + Prisma 7 | serverless Postgres, migrations run on deploy |
| Vectors | Pinecone (1536 dims) | per-workspace namespaces, managed |
| LLM | OpenAI via Vercel AI SDK v7 | streaming + structured output (`Output.object`) for artifacts |
| Jobs | Inngest | durable ingestion, retries, no queue to babysit |
| Files | Cloudinary | original PDF stays viewable beside the answer |
| Scrape | Firecrawl | clean markdown out of messy pages |
| Memory | Mem0 | long-term facts about the learner |
| Search | Tavily | optional, off by default |

---

## Run it locally

**Prereqs:** Node 22+, Docker (for Postgres), and API keys for OpenAI, Pinecone,
Cloudinary, Firecrawl, Mem0, plus Google OAuth credentials.

```bash
git clone https://github.com/bhavishya3102/NoteBookLlm.git
cd NoteBookLlm

# 1. Postgres
docker compose up -d

# 2. Backend
cd server
cp .env.example .env          # fill in the keys
npm install
npx prisma migrate dev
npm run dev                   # http://localhost:8080

# 3. Inngest dev server (new terminal) — background ingestion
npx inngest-cli@latest dev    # http://localhost:8288

# 4. Frontend (new terminal)
cd ../client
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Google OAuth redirect URI for local dev:
`http://localhost:3000/api/auth/callback/google`.

### Tuning knobs

All retrieval and cost dials sit in one file — [`server/src/lib/ai-config.ts`](./server/src/lib/ai-config.ts):

```ts
CHAT_MODEL = "gpt-4o-mini"          // default model
EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 1000 / CHUNK_OVERLAP = 100
RAG_TOP_K = 6                        // chunks per question
RAG_MIN_SCORE = 0.35                 // below this, drop the chunk
CONVERSATION_SUMMARY_INTERVAL = 8    // messages between summary jobs
RECENT_MESSAGE_WINDOW = 12
```

## Deploy

Vercel (client) + Render (server) + Neon (db). Full runbook, env var table and the
Inngest registration step: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Repository layout

```
client/                  Next.js app
  app/                   routes — (auth), (protected)/dashboard|workspace|settings
  features/              auth · workspaces · sources · chat · learn · memory
  components/ui/         shadcn primitives
  shared/                cross-feature hooks, lib, brand components
server/
  src/routes/            workspace · source · chat · artifact · memory
  src/services/          business logic (+ .md walkthroughs)
  src/repositories/      Prisma access
  src/lib/               rag/ · chunking · pinecone · openai · mem0 · firecrawl · tavily
  prisma/schema.prisma   User · Workspace · Source · SourceChunk · Conversation ·
                         Message · LearningArtifact
docker/                  local Postgres
```

## Roadmap

- [ ] Audio overview — a two-host podcast recap of a workspace
- [ ] Spaced-repetition scheduling on top of flashcards (SM-2)
- [ ] Shared / collaborative workspaces for study groups
- [ ] Handwritten-notes OCR ingestion
- [ ] Exam-mode: timed mock tests generated from the whole workspace
- [ ] Mobile PWA with offline flashcard review

---

<div align="center">
Built by <a href="https://github.com/bhavishya3102">Bhavishya Sachdeva</a> ·
Chai Code Combinator — GenAI with JS 2026
</div>
