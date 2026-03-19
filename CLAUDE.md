# SeaGeo — AI Visibility Intelligence Platform

## Project Overview
SeaGeo is a Next.js 14 platform that measures brand visibility across AI models (OpenAI, Claude, Gemini, Perplexity, Grok). It calculates an AVI (AI Visibility Index) score and provides competitor discovery, topic analysis, and source extraction.

## Tech Stack
- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS + class-variance-authority + tailwind-merge + clsx
- **Database:** Supabase (PostgreSQL + Auth + SSR)
- **AI SDKs:** OpenAI, Anthropic, Google Generative AI, Perplexity, xAI
- **Background Jobs:** Inngest (for long-running analysis tasks)
- **State:** Zustand
- **Validation:** Zod
- **Charts:** Recharts
- **UI:** Lucide icons, Sonner (toasts)
- **i18n:** Custom React Context system (lib/i18n/) — 5 languages: IT, EN, FR, DE, ES
- **Deployment:** Vercel

## Deployment & Infrastructure Constraints
- **Vercel serverless:** 60-second function timeout — use Inngest for anything longer
- **No internal fetch between API routes** on Vercel — call DB/services directly instead
- **Supabase RLS:** Some tables (competitor_avi, competitor_mentions) were created via exec_sql and may lack GRANT/RLS policies — use `createServiceClient()` for these
- **Supabase typed client:** Can infer `never` types for tables not in the generated schema — use `as any` cast or service client with explicit types
- **No local Supabase CLI** — migrations are applied directly in Supabase dashboard
- **Git auth:** HTTPS with PAT, no SSH. Use `git push origin main` explicitly

## Project Structure
```
app/
  (auth)/           - Login/register pages
  (dashboard)/      - Platform pages (dashboard, projects, analysis, results, competitors, sources, topics, compare)
  api/              - API routes
components/
  auth/             - Auth components
  charts/           - Chart components
  dashboard/        - Dashboard components (AVIRing, StatsRow, AVITrend, CompetitorBar, RecentRuns)
  layout/           - Layout components (sidebar, topbar)
  ui/               - Reusable UI primitives
  translated-label.tsx - Shared <T> component for server component i18n
lib/
  engine/
    avi.ts           - AVI score calculation (Presenza 40% + Posizione 35% + Sentiment 25%)
    extractor.ts     - Claude Haiku-based response extraction (brand detection, competitors, topics, sources)
    prompt-runner.ts - Multi-provider AI API caller (OpenAI, Anthropic, Google, Perplexity, xAI, Azure)
    models.ts        - AI model definitions and availability
    sources-extractor.ts - Source/URL extraction from AI responses
    competitor-names.ts  - Competitor name canonicalization
  i18n/
    translations.ts  - All translation keys (IT, EN, FR, DE, ES)
    context.tsx       - LanguageProvider + useTranslation() hook
    server.ts         - Server-side translation helper for API routes
  inngest-functions.ts - Background analysis pipeline (prompt execution, extraction, AVI calculation)
  inngest-competitive.ts - Competitive analysis pipeline
  supabase/          - Supabase client utilities (server.ts, client.ts, service.ts)
types/
  database.ts       - Database/Supabase types
```

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build (ALWAYS run before committing)
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript check (`tsc --noEmit`)

## Pre-Commit Checks
- ALWAYS run `npx tsc --noEmit` before committing to catch type errors
- After every commit, run `git log --oneline -1` and `git status` to verify
- After every push, confirm with `git push` output — do not just say "done"

## Conventions
- Language: Italian UI (with full i18n support), English code
- Use App Router patterns (server components by default, "use client" only when needed)
- Supabase SSR client via `@supabase/ssr`
- Utility function for class merging: `cn()` (clsx + tailwind-merge)
- All user-facing strings must use `t("key")` from useTranslation() in client components
- Server components use `<T k="key" />` from `@/components/translated-label`
- API routes use `getServerTranslator()` from `lib/i18n/server.ts`

## Supabase Type Coercion Gotcha
PostgreSQL NUMERIC and DECIMAL columns are returned as STRINGS by Supabase/PostgREST in JavaScript (e.g. `"1"` instead of `1`).
Always wrap numeric DB fields with `Number()` before any strict comparison (`===`) or arithmetic.

- **Affected types:** NUMERIC, DECIMAL, any custom numeric column
- **Safe types** returned as native JS numbers: INT, BIGINT, FLOAT

Pattern to always use:
```ts
const value = Number(row.some_numeric_column);
if (value === 1) { ... }
```

Never:
```ts
if (row.some_numeric_column === 1) { ... }  // always false
```

## Debugging Guidelines
When data exists in DB but doesn't display in UI, check the full flow BEFORE attempting fixes:
1. DB query and column names (case sensitivity, RLS policies)
2. API response shape (log the actual response)
3. Frontend component prop mapping
4. Add `console.log` at each layer first — do NOT guess at fixes

## Analysis Pipeline Architecture
```
User triggers analysis → Inngest function starts
  → For each query × model × run:
    1. callAIModel() in prompt-runner.ts (provider-specific API call)
    2. extractFromResponse() in extractor.ts:
       a. detectBrandMention() — case-insensitive, accent-insensitive, markdown-stripped
       b. Claude Haiku extracts: rank, sentiment, competitors, topics, sources
    3. Save to prompts_executed + response_analysis + competitor_mentions + sources
  → computeAndSaveAVI() — calculates AVI score from all response_analysis rows
  → computeCompetitorAVI() — calculates per-competitor AVI scores
```

## Web Search / Browsing
- Anthropic: `web_search_20250305` (stable) — `web_search_20260209` was reverted
- OpenAI: `web_search_preview` via Responses API
- Gemini: `googleSearch` grounding tool
- Perplexity: native search (always on)
- `max_uses`: 3, `user_location`: IT / Europe/Rome
- `blocked_domains`: facebook.com, instagram.com, twitter.com, tiktok.com (Anthropic only)
- All providers fall back to standard mode if browsing fails
- `browsing` defaults to `true` in UI and API

## Cost Architecture

### Plan Structure

| | **Base** | **Pro** |
|---|---|---|
| Monthly prompts | 100 | 500 |
| Max models/project | 3 | 5 |
| Comparisons/month | 0 | 10 (separate counter) |
| AI query generation | YES | YES |
| Dataset access | NO | YES |
| Comparisons access | NO | YES |
| Price | €99/month | €199/month |

### How Prompts Are Counted
Each prompt executed = 1 unit consumed from monthly limit.
`prompts = queries × models × segments × run_count` (all counted together).
Example: 10 queries × 3 models × 1 segment × 2 runs = **60 prompts consumed**.

### How Comparisons Are Counted
Each comparison analysis = 1 unit (regardless of internal prompts).
A typical comparison generates ~27 prompts internally but counts as 1 comparison.

### AI Cost Per Prompt
Each prompt makes 2 API calls:
1. **Main AI model** (GPT, Gemini, Claude, Perplexity, Grok)
2. **Claude Haiku extractor** (brand/competitor extraction) — always ~$0.0016

| Model | Main call | + Haiku | **Total/prompt** |
|---|---|---|---|
| GPT-4o Mini | $0.001 | $0.0016 | **$0.003** |
| Gemini 2.5 Flash | $0.0008 | $0.0016 | **$0.0024** |
| Claude Haiku | $0.0005 | $0.0016 | **$0.0021** |
| Perplexity Sonar | $0.002 | $0.0016 | **$0.0036** |
| **Average across models** | ~$0.0014 | $0.0016 | **~$0.003** |

### AI Cost Per Comparison
~27 prompts × 2 calls each:
- Main model: ~27 × $0.002 = ~$0.054
- Haiku extractor: ~27 × $0.0005 = ~$0.014
- **Total per comparison: ~$0.068**

### Monthly AI Cost Per User (worst case — full usage)

| Plan | Prompts | Comparisons | Query gen | **Total AI cost** |
|---|---|---|---|---|
| Base | 100 × $0.003 = $0.30 | — | ~$0.01 | **~$0.31** |
| Pro | 500 × $0.003 = $1.50 | 10 × $0.068 = $0.68 | ~$0.03 | **~$2.21** |

### Infrastructure Costs (fixed, shared)
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Inngest: free tier (up to 50k events/month)
- **Total fixed: ~$45/month** (scales to ~$100 at 500+ users)

### Margin Analysis (€99 Base / €199 Pro, 70/30 mix)

| Users | Base | Pro | Revenue | AI costs | Infra | **Profit** | **Margin** |
|---|---|---|---|---|---|---|---|
| 10 | 7 | 3 | €440 | €8 | €45 | **€387** | **88%** |
| 50 | 35 | 15 | €2,200 | €41 | €45 | **€2,114** | **96%** |
| 100 | 70 | 30 | €4,400 | €82 | €45 | **€4,273** | **97%** |
| 500 | 350 | 150 | €22,000 | €409 | €100 | **€21,491** | **98%** |

### Margin by plan (single user)

| Plan | Price | AI cost | **Gross margin** |
|---|---|---|---|
| Base | €99 | €0.29 | **€28.71 (99%)** |
| Pro | €199 | €2.05 | **€76.95 (97%)** |

### Break-Even (infra only, €45/month)
- 2 Base users (2 × €29 = €58 > €45)
- 1 Pro user (€79 > €45)

## Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`
- `PERPLEXITY_API_KEY`
- `XAI_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
