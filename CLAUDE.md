# SeaGeo - AI Visibility Intelligence Platform

## Project Overview
SeaGeo is a Next.js 14 platform that measures brand visibility across AI models (OpenAI, Claude, Gemini). It calculates an AVI (AI Visibility Index) score and provides competitor discovery, topic analysis, and source extraction.

## Tech Stack
- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS + class-variance-authority + tailwind-merge + clsx
- **Database:** Supabase (PostgreSQL + Auth + SSR)
- **AI SDKs:** OpenAI, Anthropic
- **State:** Zustand
- **Validation:** Zod
- **Charts:** Recharts
- **UI:** Lucide icons, Sonner (toasts)
- **Deployment:** Vercel

## Project Structure
```
app/
  (auth)/           - Login/register pages
  (dashboard)/      - Platform pages (dashboard, projects, analysis, results, competitors, sources, topics, compare)
  api/              - API routes
components/
  auth/             - Auth components
  charts/           - Chart components
  dashboard/        - Dashboard components
  layout/           - Layout components
  ui/               - Reusable UI primitives
lib/
  ai/               - AI model connectors
  engine/           - AVI calculation engine
  hooks/            - Custom React hooks
  supabase/         - Supabase client utilities
  utils/            - Shared utilities
types/
  database.ts       - Database/Supabase types
supabase/
  migrations/       - SQL migration files
```

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript check (`tsc --noEmit`)

## Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## Conventions
- Language: Italian UI, English code
- Use App Router patterns (server components by default, "use client" only when needed)
- Supabase SSR client via `@supabase/ssr`
- Utility function for class merging: `cn()` (clsx + tailwind-merge)
