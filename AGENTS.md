# AGENTS.md

## Project Context
KIPPRA StyleGuard application powered by React (Vite), Express (`server.ts`), Supabase (Postgres SQL, `pgvector`, Auth, Private Storage), and `@google/genai`.

## Key Files
- `server.ts`: Express API server (`/api/*`) + Vite middleware (port 3000).
- `src/lib/supabaseClient.js`: Client-side Supabase Auth & PostgREST client (`VITE_SUPABASE_PUBLISHABLE_KEY`).
- `src/lib/db.js`: Unified entity & storage data layer mapping UI models to Supabase PostgreSQL tables.
- `supabase/migrations/`: Idempotent DDL (`0001_schema.sql`), RLS & Storage policies (`0002_security.sql`), and seed rules (`0003_seed_rules.sql`).

## Working Notes
- Keep `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` strictly server-side (`server.ts`). Never bundle them into `VITE_*` variables.
- Run `npm run build` and `npm run lint` after changes.
