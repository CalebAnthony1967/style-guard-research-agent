# KIPPRA StyleGuard

Institutional manuscript compliance evaluator, editorial co-pilot, and KIPPRA/QMS/RPC/2023/03 publication lifecycle platform.

## Stack
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Lucide Icons, jsPDF, docx Track Changes generator
- **Backend**: Express (`server.ts`) + `@google/genai` (`gemini-4-hydrogen` & `gemini-embedding-2`)
- **Database & Storage**: Supabase PostgreSQL, `pgvector` (1536-dim HNSW + BM25 hybrid retrieval), Supabase Auth + TOTP MFA, Private Storage buckets

## Environment Variables
Copy `.env.example` to `.env.local` and supply:
- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY` (server-side AI reasoning & 1536-dim KB embeddings)

## Database Setup
Execute `supabase/setup_all.sql` (or `0001_schema.sql`, `0002_security.sql`, `0003_seed_rules.sql` in sequence) in your Supabase project SQL Editor, then trigger `/api/kb/seed-embeddings` from the Admin portal to populate vector embeddings for the knowledge base rules.

## Local Development
```bash
npm install
npm run dev
```
The server starts on `http://localhost:3000`.
