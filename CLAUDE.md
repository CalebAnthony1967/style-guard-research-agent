# KIPPRA StyleGuard — Engineering Guide

KIPPRA StyleGuard is an institutional manuscript compliance, policy drafting evaluation, and QMS publication control platform built on **React (Vite)**, **Express**, **Supabase** (PostgreSQL + `pgvector` + Auth + Private Storage), and **Google Gemini (`@google/genai`)**.

## Architecture
- **Frontend (`src/`)**: React 18 SPA with role-based workspaces across the 9 KIPPRA portals (`Researcher`, `Hod`, `Director`, `Seminar`, `Executive`, `Km`, `Editor`, `Admin`, `Vault`).
- **Backend (`server.ts`)**: Express server hosting Vite middleware in dev and static assets in production on port `3000`. All sensitive operations (`SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, pgvector hybrid search, admin user management, hash-chained audit logging) execute server-side behind Supabase JWT verification.
- **Database & Vector RAG (`supabase/migrations/`)**:
  - `0001_schema.sql`: Core relational schema (`users`, `documents`, `document_versions`, `qms_publication_control`, `kippra_knowledge_base` with 1536-dim `vector(1536)` + `tsvector` GIN/HNSW indexes, `compliance_audits`, `compliance_findings`, `chat_sessions`, `chat_messages`, `system_audit_logs`, `break_glass_sessions`, `key_shares`), triggers, and `match_kippra_rules` hybrid search RPC.
  - `0002_security.sql`: Strict Row Level Security (RLS) policies and private Supabase Storage policies across all 12 tables and 5 private buckets.
  - `0003_seed_rules.sql`: Initial institutional rule set from the KIPPRA House Style Manual (2010), PP/06/2020, and QMS control form `KIPPRA/QMS/RPC/2023/03`.
  - `setup_all.sql`: Combined idempotent migration script for one-shot execution in the Supabase SQL Editor.

## Commands
- `npm run dev` — Start Express + Vite dev server on port `3000`
- `npm run build` — Build frontend bundle into `dist/`
- `npm run start` — Serve Express + `dist/` in production on port `3000`
- `npm run lint` — Run ESLint