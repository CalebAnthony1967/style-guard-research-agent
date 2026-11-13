-- ============================================================================
-- KIPPRA StyleGuard — core schema
-- Mirrors the application's data model exactly. Safe to run repeatedly.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 1. OFFICER PROFILES (1:1 with Supabase Auth users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key,
  email varchar(255) not null,
  full_name varchar(255) not null default '',
  role varchar(50) not null default 'RESEARCHER',
  directorate varchar(150) not null default '',
  department varchar(150) not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists department varchar(150) not null default '';
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users alter column full_name set default '';
alter table public.users drop column if exists password_hash;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.users'::regclass and contype = 'c'
  loop execute format('alter table public.users drop constraint %I', c.conname); end loop;
end $$;

alter table public.users add constraint users_role_check check (role in (
  'RESEARCHER', 'HOD', 'DIRECTOR', 'SEMINAR_PANEL', 'EXECUTIVE_DIRECTOR',
  'DEPUTY_DIRECTOR_KM', 'PUBLICATIONS_EDITOR', 'ADMIN', 'SUPER_ADMIN_VAULT'
));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_email_key' and conrelid = 'public.users'::regclass) then
    begin
      alter table public.users add constraint users_email_key unique (email);
    exception when others then null;
    end;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_auth_fkey' and conrelid = 'public.users'::regclass) then
    begin
      alter table public.users add constraint users_auth_fkey
        foreign key (id) references auth.users(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end $$;

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_department on public.users(department);

-- ---------------------------------------------------------------------------
-- 2. MANUSCRIPTS
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  title varchar(500) not null,
  paper_type varchar(100) not null,
  original_filename varchar(255) not null default '',
  mime_type varchar(100) not null default 'application/octet-stream',
  s3_storage_uri varchar(1024) not null default '',
  file_hash_sha256 varchar(64) not null default '',
  expected_research_outputs text default '',
  tor_file_s3_uri varchar(1024),
  allowed_roles text[] default array['RESEARCHER','HOD','DIRECTOR','ADMIN'],
  created_at timestamptz not null default now()
);

alter table public.documents add column if not exists storage_path varchar(1024) not null default '';
alter table public.documents add column if not exists tor_storage_path varchar(1024);
alter table public.documents add column if not exists stage text not null default 'DRAFT_SUBMITTED';
alter table public.documents add column if not exists status text not null default 'DRAFT';
alter table public.documents add column if not exists abstract text default '';
alter table public.documents add column if not exists manuscript_text text default '';
alter table public.documents add column if not exists department text default '';
alter table public.documents add column if not exists directorate text default '';
alter table public.documents add column if not exists owner_name text default '';
alter table public.documents add column if not exists owner_email text default '';
alter table public.documents add column if not exists latest_score numeric(5,2);
alter table public.documents add column if not exists latest_audit_id uuid;
alter table public.documents add column if not exists can_route_to_hod boolean not null default false;
alter table public.documents add column if not exists supervisory_note text default '';
alter table public.documents add column if not exists repository_uri text default '';
alter table public.documents add column if not exists isbn varchar(40) default '';
alter table public.documents add column if not exists revision_text text default '';
alter table public.documents add column if not exists tor_text text default '';
alter table public.documents add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.documents alter column s3_storage_uri set default '';
exception when undefined_column then null;
end $$;
do $$ begin
  alter table public.documents alter column file_hash_sha256 set default '';
exception when undefined_column then null;
end $$;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.documents'::regclass and contype = 'c'
  loop execute format('alter table public.documents drop constraint %I', c.conname); end loop;
end $$;

alter table public.documents add constraint documents_paper_type_check check (paper_type in (
  'Discussion Paper', 'Working Paper', 'Policy Paper', 'Policy Brief', 'Policy Memoranda',
  'Kenya Economic Report', 'KIPPRA Policy Monitor', 'Policy Monitor', 'Special Paper',
  'Occasional Paper', 'Research Paper', 'Media Article'
));

alter table public.documents add constraint documents_stage_check check (stage in (
  'DRAFT_SUBMITTED', 'CONCEPT_PRESENTED_DEPT', 'DRAFT_PRESENTED_DEPT',
  'DIRECTOR_REVIEW_COMPLETED', 'WIS_SCHEDULED', 'WIS_COMPLETED', 'DECISION_COMMUNICATED',
  'EXECUTIVE_DIRECTOR_AUTHORIZED', 'KM_RECEIVED', 'EDITORIAL_FIRST_TYPESETTING',
  'EDITORIAL_SECOND_REVIEW', 'AUTHOR_FEEDBACK_CYCLE', 'FINAL_CORRECTIONS_INCORPORATED',
  'PRINTING_REQUISITIONED'
));

alter table public.documents add constraint documents_status_check check (status in (
  'DRAFT', 'IN_AUDIT', 'AWAITING_SIGNOFF', 'RETURNED', 'APPROVED', 'PUBLISHED'
));

create index if not exists idx_documents_user on public.documents(user_id);
create index if not exists idx_documents_stage on public.documents(stage);
create index if not exists idx_documents_department on public.documents(department);

-- ---------------------------------------------------------------------------
-- 3. MANUSCRIPT VERSIONS
-- ---------------------------------------------------------------------------
alter table public.document_versions add column if not exists storage_path varchar(1024) not null default '';
alter table public.document_versions add column if not exists text_snapshot text default '';
alter table public.document_versions add column if not exists created_by_email text default '';
alter table public.document_versions alter column created_by drop not null;
do $$ begin
  alter table public.document_versions alter column s3_storage_uri set default '';
exception when undefined_column then null;
end $$;
create unique index if not exists uq_document_version
  on public.document_versions(document_id, version_number);

-- ---------------------------------------------------------------------------
-- 4. PUBLICATION CONTROL (KIPPRA/QMS/RPC/2023/03 Rev. 3)
-- ---------------------------------------------------------------------------
create table if not exists public.qms_publication_control (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  form_ref_no varchar(100) not null default 'KIPPRA/QMS/RPC/2023/03',
  revision_no int not null default 3,
  current_stage text not null default 'DRAFT_SUBMITTED',
  concept_presentation_date date,
  concept_hod_signer text default '',
  concept_hod_signed_at timestamptz,
  draft_presentation_date date,
  draft_hod_signer text default '',
  draft_hod_signed_at timestamptz,
  director_receipt_date date,
  director_review_completed_date date,
  director_signer text default '',
  director_signed_at timestamptz,
  cleared_to_wis_date date,
  wis_presentation_date date,
  wis_director_signer text default '',
  wis_panel_decision text,
  wis_rapporteur text default '',
  decision_communicated_date date,
  ed_authorization_date date,
  ed_signer text default '',
  ed_signed_at timestamptz,
  km_receipt_date date,
  km_signer text default '',
  km_signed_at timestamptz,
  repository_handle text default '',
  knowledge_vectorised boolean not null default false,
  typesetting_commenced date,
  typesetting_completed date,
  typesetting_conducted_by text default '',
  editorial_comments_sent_date date,
  editorial_feedback_received_date date,
  final_corrections_incorporated_date date,
  printing_requisition_date date,
  print_specification text default '',
  is_fully_completed boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qms_publication_control drop constraint if exists qms_publication_control_wis_panel_decision_check;
alter table public.qms_publication_control add constraint qms_publication_control_wis_panel_decision_check
  check (wis_panel_decision is null or wis_panel_decision in (
    'SUBMIT_FOR_PUBLICATION', 'REVISE_SUBMIT_MINOR', 'REVISE_REPRESENT_MAJOR'
  ));

create index if not exists idx_qms_stage on public.qms_publication_control(current_stage);

-- ---------------------------------------------------------------------------
-- 5. KNOWLEDGE BASE (House Style 2010, PP 06/2020, QMS, repository)
-- ---------------------------------------------------------------------------
alter table public.kippra_knowledge_base add column if not exists source_type varchar(100) not null default 'HOUSE_STYLE_2010';
alter table public.kippra_knowledge_base add column if not exists source_uri varchar(1024) not null default '';
alter table public.kippra_knowledge_base add column if not exists manual_reference text default '';
alter table public.kippra_knowledge_base add column if not exists severity_default varchar(20) not null default 'WARNING';
alter table public.kippra_knowledge_base alter column sharepoint_item_id drop not null;
alter table public.kippra_knowledge_base alter column source_document drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kb_severity_check' and conrelid = 'public.kippra_knowledge_base'::regclass) then
    alter table public.kippra_knowledge_base add constraint kb_severity_check
      check (severity_default in ('CRITICAL','WARNING','INFO'));
  end if;
end $$;

create unique index if not exists uq_kb_rule on public.kippra_knowledge_base(rule_identifier);
create index if not exists idx_kb_section on public.kippra_knowledge_base(section_category);

-- ---------------------------------------------------------------------------
-- 6. COMPLIANCE AUDITS AND FINDINGS
-- ---------------------------------------------------------------------------
alter table public.compliance_audits add column if not exists can_route_to_hod boolean not null default false;
alter table public.compliance_audits add column if not exists priority_actions jsonb not null default '[]'::jsonb;
alter table public.compliance_audits add column if not exists qualities jsonb not null default '[]'::jsonb;
alter table public.compliance_audits add column if not exists citation_parity jsonb not null default '{}'::jsonb;
alter table public.compliance_audits add column if not exists agent_trace jsonb not null default '[]'::jsonb;
alter table public.compliance_audits add column if not exists findings_total int not null default 0;
alter table public.compliance_audits add column if not exists findings_critical int not null default 0;
alter table public.compliance_audits add column if not exists findings_warning int not null default 0;
alter table public.compliance_audits add column if not exists word_count int not null default 0;
alter table public.compliance_audits add column if not exists inference_engine text default 'Guardian editorial assistant';
alter table public.compliance_audits add column if not exists executed_by_email text default '';
alter table public.compliance_audits add column if not exists version_number int not null default 1;
alter table public.compliance_audits alter column version_id drop not null;
alter table public.compliance_audits alter column executed_by drop not null;

alter table public.compliance_findings add column if not exists manuscript_id uuid references public.documents(id) on delete cascade;
alter table public.compliance_findings add column if not exists rule_title text default '';
alter table public.compliance_findings add column if not exists character_start int;
alter table public.compliance_findings add column if not exists character_end int;
alter table public.compliance_findings add column if not exists created_at timestamptz not null default now();

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.compliance_findings'::regclass and contype = 'c'
  loop execute format('alter table public.compliance_findings drop constraint %I', c.conname); end loop;
end $$;

alter table public.compliance_findings add constraint findings_category_check check (vector_category in (
  'LAYOUT_AND_FRONT_MATTER', 'STYLE_AND_SPELLING', 'TABLES_AND_FIGURES',
  'CITATIONS_AND_BIBLIOGRAPHY', 'POLICY_DRAFTING_RIGOR', 'OUTPUT_ALIGNMENT'
));
alter table public.compliance_findings add constraint findings_severity_check
  check (severity in ('CRITICAL','WARNING','INFO'));
alter table public.compliance_findings add constraint findings_status_check
  check (status in ('OPEN','ACCEPTED','REJECTED'));

create index if not exists idx_findings_audit on public.compliance_findings(audit_id);
create index if not exists idx_audits_document on public.compliance_audits(document_id);

-- ---------------------------------------------------------------------------
-- 7. GUARDIAN CONVERSATIONS
-- ---------------------------------------------------------------------------
alter table public.chat_sessions add column if not exists title text default 'Conversation';
alter table public.chat_messages add column if not exists ui_visualizations jsonb not null default '[]'::jsonb;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.chat_sessions'::regclass and contype = 'c'
  loop execute format('alter table public.chat_sessions drop constraint %I', c.conname); end loop;
end $$;

alter table public.chat_sessions add constraint chat_sessions_mode_check
  check (current_mode in ('GENERAL_CHAT','PAPER_EVALUATION','CO_PILOT_EDIT','SEMINAR_FACT_CHECK'));

-- ---------------------------------------------------------------------------
-- 8. IMMUTABLE AUDIT TRAIL (WORM)
-- ---------------------------------------------------------------------------
alter table public.system_audit_logs add column if not exists actor_id uuid;
alter table public.system_audit_logs add column if not exists actor_email text default '';
alter table public.system_audit_logs add column if not exists actor_role text default '';
alter table public.system_audit_logs add column if not exists summary text default '';
alter table public.system_audit_logs add column if not exists prev_hash varchar(64) default '';
alter table public.system_audit_logs add column if not exists hash_input text default '';
alter table public.system_audit_logs add column if not exists manuscript_id uuid;
alter table public.system_audit_logs alter column ip_address drop not null;
do $$ begin
  alter table public.system_audit_logs alter column user_id drop not null;
exception when undefined_column then null;
end $$;
do $$ begin
  alter table public.system_audit_logs alter column payload_hash set default '';
exception when undefined_column then null;
end $$;

create or replace function public.prevent_audit_log_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'The audit trail is append-only and cannot be changed or deleted.';
end;
$$;

drop trigger if exists trg_audit_log_immutability on public.system_audit_logs;
create trigger trg_audit_log_immutability
  before update or delete on public.system_audit_logs
  for each row execute function public.prevent_audit_log_mutation();

create index if not exists idx_audit_log_manuscript on public.system_audit_logs(manuscript_id);

-- ---------------------------------------------------------------------------
-- 9. VAULT: BREAK-GLASS SESSIONS AND CUSTODIAN SHARES
-- ---------------------------------------------------------------------------
create table if not exists public.break_glass_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by_email text not null default '',
  reason text not null default '',
  shares_verified int not null default 0,
  opened_at timestamptz not null default now(),
  expires_at timestamptz,
  status varchar(20) not null default 'OPEN' check (status in ('OPEN','CLOSED','EXPIRED'))
);

create table if not exists public.key_shares (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  share_index int not null default 0,
  code_hash text not null default '',
  issuer_email text default '',
  custodian text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. TIMESTAMP + FULL-TEXT TRIGGERS
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_qms_updated on public.qms_publication_control;
create trigger trg_qms_updated before update on public.qms_publication_control
  for each row execute function public.set_updated_at();

create or replace function public.kippra_kb_tsv_update() returns trigger
language plpgsql as $$
begin
  new.tsv_content := to_tsvector('english',
    coalesce(new.rule_title, '') || ' ' || coalesce(new.rule_content, ''));
  return new;
end;
$$;

drop trigger if exists trg_kippra_kb_tsv on public.kippra_knowledge_base;
create trigger trg_kippra_kb_tsv
  before insert or update on public.kippra_knowledge_base
  for each row execute function public.kippra_kb_tsv_update();

create index if not exists idx_kb_tsv on public.kippra_knowledge_base using gin (tsv_content);
create index if not exists idx_kb_paper_types on public.kippra_knowledge_base using gin (applicable_paper_types);

do $$ begin
  begin
    create index if not exists idx_kb_embedding on public.kippra_knowledge_base
      using hnsw (embedding vector_cosine_ops);
  exception when others then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 11. PROFILE PROVISIONING FROM SUPABASE AUTH
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role, directorate, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'RESEARCHER'),
    coalesce(new.raw_user_meta_data->>'directorate', ''),
    coalesce(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 12. HYBRID RETRIEVAL (vector 70% + BM25 30%)
-- ---------------------------------------------------------------------------
create or replace function public.match_kippra_rules(
  query_embedding vector(1536),
  query_text text,
  target_paper_type text,
  match_count int default 8
)
returns table (
  id uuid,
  rule_identifier varchar,
  rule_title varchar,
  rule_content text,
  section_category varchar,
  combined_score float
)
language sql stable as $$
  select
    kb.id,
    kb.rule_identifier::varchar,
    kb.rule_title::varchar,
    kb.rule_content,
    kb.section_category::varchar,
    (
      coalesce(1 - (kb.embedding <=> query_embedding), 0) * 0.70
      + coalesce(ts_rank_cd(kb.tsv_content, plainto_tsquery('english', coalesce(query_text, ''))), 0) * 0.30
    )::float as combined_score
  from public.kippra_knowledge_base kb
  where kb.applicable_paper_types::text[] @> array[target_paper_type]::text[]
     or kb.applicable_paper_types::text[] @> array['ALL']::text[]
  order by combined_score desc
  limit match_count;
$$;

grant execute on function public.match_kippra_rules(vector, text, text, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. STORAGE BUCKETS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('manuscripts', 'manuscripts', false),
  ('revisions', 'revisions', false),
  ('compliance-reports', 'compliance-reports', false),
  ('tor-benchmarks', 'tor-benchmarks', false),
  ('kippra-e-repository', 'kippra-e-repository', false)
on conflict (id) do nothing;