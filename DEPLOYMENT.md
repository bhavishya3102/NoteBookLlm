# Deployment — Manthan

Frontend on **Vercel**, backend on **Render**, database on **Neon**.

The client never calls the API cross-origin: `client/next.config.ts` rewrites
`/api/auth/*`, `/api/workspaces*` and `/api/memory*` to `API_URL`. The browser
only ever sees the Vercel origin, which is what keeps the Better Auth session
cookie first-party.

> `API_URL` is read at **build** time by `next.config.ts`. Changing it in the
> Vercel dashboard has no effect until you redeploy.

---

## 1. Database — Neon

1. Create a project at <https://console.neon.tech>.
2. Copy the **direct** connection string — the one *without* `-pooler` in the
   host. Neon shows the pooled URL by default; untick "Connection pooling".
3. Keep `?sslmode=require` on the end.

Use the direct URL, not the pooled one, for two reasons: `prisma migrate deploy`
runs during the Render build and needs a direct connection, and the server opens
its own `pg.Pool` in `server/src/lib/db.ts`, so PgBouncer adds nothing for a
single long-lived Render instance.

No extensions are needed. Embeddings live in Pinecone, not Postgres.

Migrations run automatically on every Render build via `prisma migrate deploy`.

## 2. Backend — Render

`render.yaml` in the repo root is a Blueprint. In the Render dashboard choose
**New → Blueprint**, point it at this GitHub repo, and it will create the
`chaibook-api` web service with `rootDir: server`.

Build:  `npm ci --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy`
Start:  `npm run start`
Health: `/health`

`--include=dev` is required: `NODE_ENV=production` makes `npm ci` skip
devDependencies, and `typescript` lives there, so `tsc` would be missing.

Set these in the Render dashboard (the blueprint marks them `sync: false`):

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon **direct** (unpooled) URL from step 1 |
| `CLIENT_URL` | Vercel URL — `https://manthan-llm-delta.vercel.app` — drives CORS |
| `BETTER_AUTH_URL` | Same Vercel URL |
| `BETTER_AUTH_SECRET` | Render generates one; or reuse your own |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth credentials |
| `OPENAI_API_KEY` | chat + embeddings |
| `PINECONE_API_KEY` / `PINECONE_INDEX` | index auto-created at 1536 dims |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | PDF uploads |
| `FIRECRAWL_API_KEY` | website imports |
| `MEM0_API_KEY` | memory feature |
| `TAVILY_API_KEY` | optional — web search silently disables without it |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | from Inngest Cloud |

Do **not** set `INNGEST_DEV` in production, and do not set `PORT` — Render
injects it.

### Inngest

Source ingestion runs as a background job. In Inngest Cloud, register the app
endpoint `https://<render-url>/api/inngest`, then copy the event and signing
keys into Render.

> Render's free plan sleeps after inactivity. The first request after a sleep
> takes ~30s, and a sleeping instance cannot serve Inngest callbacks. Use a
> paid instance if background ingestion matters.

## 3. Frontend — Vercel

Import the GitHub repo at <https://vercel.com/new> and set:

- **Root Directory**: `client`
- **Framework**: Next.js (auto-detected)

Environment variables:

| Variable | Value |
| --- | --- |
| `API_URL` | Render service URL, e.g. `https://chaibook-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | The Vercel URL itself — `https://manthan-llm-delta.vercel.app` |

Or from the CLI:

```bash
cd client
npx vercel link
npx vercel env add API_URL production
npx vercel env add NEXT_PUBLIC_APP_URL production
npx vercel --prod
```

## 4. Google OAuth

In Google Cloud Console → Credentials → your OAuth client, add the authorized
redirect URI:

```
https://manthan-llm-delta.vercel.app/api/auth/callback/google
```

It points at Vercel, not Render, because Better Auth's `baseURL` is
`BETTER_AUTH_URL` and the request is proxied through the Next.js rewrite.

## 5. Order of operations

The two services reference each other's URLs, so:

1. Deploy Render with a placeholder `CLIENT_URL` / `BETTER_AUTH_URL`.
2. Deploy Vercel with `API_URL` set to the real Render URL.
3. Go back and set `CLIENT_URL` + `BETTER_AUTH_URL` to the real Vercel URL.
4. Add the Google redirect URI.
5. Redeploy Vercel so the rewrite bakes in the final `API_URL`.

## 6. Smoke test

```bash
curl https://<render-url>/health                  # {"status":"ok"}
curl https://manthan-llm-delta.vercel.app/api/auth/get-session   # proxied through to Render
```

Then sign in with Google, create a workspace, and upload a PDF source.
