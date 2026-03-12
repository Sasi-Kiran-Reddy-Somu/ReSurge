# Reddit Growth Tracker

**Stack: TypeScript + Hono + Drizzle + Redis + PostgreSQL + BullMQ**

---

## Project Structure

```
reddit-tracker/
├── backend/                     # Hono API + BullMQ workers
│   ├── src/
│   │   ├── index.ts             # Entry point — starts Hono + workers
│   │   ├── types/index.ts       # Shared TypeScript types
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle schema (subreddits, posts, thresholds)
│   │   │   ├── client.ts        # Drizzle + postgres.js connection
│   │   │   └── seed.ts          # Seed default thresholds + starter subs
│   │   ├── lib/
│   │   │   ├── redis.ts         # ioredis connections
│   │   │   ├── queue.ts         # BullMQ queue + job scheduler
│   │   │   ├── redditFetcher.ts # Reddit .json API calls
│   │   │   └── stackEngine.ts   # Stack transition logic
│   │   ├── workers/
│   │   │   └── pollWorker.ts    # BullMQ worker — processes poll jobs
│   │   └── routes/
│   │       ├── subreddits.ts    # CRUD for tracked subreddits
│   │       ├── posts.ts         # Stack queries + dismiss
│   │       └── thresholds.ts   # Read + update thresholds
│   ├── drizzle/                 # Auto-generated migrations
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                    # React app
│   ├── src/
│   │   ├── App.js
│   │   ├── hooks/useTracker.js  # All API calls + state
│   │   ├── components/
│   │   │   ├── Sidebar.js       # Subreddit list
│   │   │   ├── SliderPanel.js   # Threshold sliders
│   │   │   ├── Stack4Feed.js    # Viral post feed
│   │   │   └── StackModal.js    # Stack 1/2/3 popup
│   │   └── utils/api.js         # Fetch wrapper
│   └── package.json
│
└── package.json                 # Root workspace
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted)
- Redis (local or hosted)

---

## Setup

### 1. Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/reddit_tracker
REDIS_URL=redis://localhost:6379
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### 3. Create the database

```bash
createdb reddit_tracker   # or create it via pgAdmin / your DB tool
```

### 4. Run migrations

```bash
cd backend
npm run db:generate   # generates SQL from schema
npm run db:migrate    # applies migrations to DB
```

### 5. Seed default data

```bash
npx tsx src/db/seed.ts
```

This inserts the default thresholds row and starter subreddits (entrepreneur, startups).

### 6. Start everything

**In two terminals:**

Terminal 1 — Backend:
```bash
cd backend
npm run dev
```

Terminal 2 — Frontend:
```bash
cd frontend
npm start
```

Open http://localhost:3000

---

## How It Works

```
BullMQ schedules one repeatable job per subreddit (every 60 seconds)
         │
         ▼
pollWorker.ts runs for each subreddit:
  1. Fetch /r/{sub}/new.json (up to 100 posts)
  2. INSERT new posts into Stack 1 (postgres, on conflict do nothing)
  3. Refresh engagement for Stack 2 + 3 posts via info.json
  4. Run stackEngine.ts:
       Stack 1: post age >= s1MinAge AND engagement >= s1MinEng → Stack 2, else discard
       Stack 2: time in stack >= s2MinAge AND growth >= s2GrowthPct% → Stack 3, else discard
       Stack 3: time in stack >= s3MinAge AND growth >= s3GrowthPct% → Stack 4 (ALERT!), else discard
         │
         ▼
Frontend polls /api/posts/stack4/all every 15 seconds
Clicking S1/S2/S3 badges fetches live posts from /api/posts/{sub}/stack/{n}
Sliders update /api/thresholds on save
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/subreddits | List active subreddits |
| POST | /api/subreddits | Add subreddit `{ name }` |
| DELETE | /api/subreddits/:name | Remove subreddit |
| GET | /api/posts/:sub/stack/:n | Posts in stack 1–4 |
| GET | /api/posts/stack4/all | All Stack 4 posts (optionally ?subreddit=x) |
| GET | /api/posts/:sub/counts | Stack counts for subreddit |
| DELETE | /api/posts/:id/dismiss | Dismiss a Stack 4 post |
| GET | /api/thresholds | Current thresholds |
| PUT | /api/thresholds | Update thresholds |

---

## Adding AI Comment Generation

In `frontend/src/components/Stack4Feed.js`, wire the Generate Comment button:

```js
async function handleGenerate(post) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id }),
  });
  const { suggestions } = await res.json();
  // suggestions = [{ tone: "Witty", comment: "..." }, ...]
}
```

Add `POST /api/generate` in the backend that calls Claude or OpenAI with the post context.

---

## Scaling to 40+ Subreddits

- BullMQ worker has `concurrency: 5` — processes 5 subreddits in parallel
- 1.2s stagger between Reddit fetches keeps rate usage under 60 req/min
- All state is in PostgreSQL — server restarts are safe, BullMQ reschedules all jobs on startup
- Redis handles job queue state (BullMQ) — no data loss on restart
