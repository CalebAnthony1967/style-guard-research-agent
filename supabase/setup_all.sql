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
-- ============================================================================
-- KIPPRA StyleGuard — Row Level Security (RLS) & Private Storage Policies
-- Safe to run repeatedly. Covers all 12 tables and 5 private Storage buckets.
-- ============================================================================

-- Helper: resolve caller's KIPPRA role without triggering recursive RLS on users
create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role::text from public.users where id = auth.uid()),
    'RESEARCHER'
  );
$$;

grant execute on function public.current_user_role() to authenticated, service_role;

create or replace function public.current_user_department() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select department::text from public.users where id = auth.uid()), '');
$$;

grant execute on function public.current_user_department() to authenticated, service_role;

create or replace function public.is_governance_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_user_role() in ('ADMIN', 'SUPER_ADMIN_VAULT');
$$;

grant execute on function public.is_governance_admin() to authenticated, service_role;

create or replace function public.is_workflow_officer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_user_role() in (
    'HOD', 'DIRECTOR', 'SEMINAR_PANEL', 'EXECUTIVE_DIRECTOR',
    'DEPUTY_DIRECTOR_KM', 'PUBLICATIONS_EDITOR', 'ADMIN', 'SUPER_ADMIN_VAULT'
  );
$$;

grant execute on function public.is_workflow_officer() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.qms_publication_control enable row level security;
alter table public.kippra_knowledge_base enable row level security;
alter table public.compliance_audits enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.system_audit_logs enable row level security;
alter table public.break_glass_sessions enable row level security;
alter table public.key_shares enable row level security;

-- ---------------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------------
drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_workflow_officer());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated
  with check (id = auth.uid() or public.is_governance_admin());

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_governance_admin())
  with check (id = auth.uid() or public.is_governance_admin());

-- ---------------------------------------------------------------------------
-- 2. DOCUMENTS
-- ---------------------------------------------------------------------------
drop policy if exists documents_select_policy on public.documents;
create policy documents_select_policy on public.documents
  for select to authenticated
  using (
    user_id = auth.uid()
    or owner_email = (auth.jwt()->>'email')
    or (
      nullif(department, '') is not null
      and department = public.current_user_department()
    )
    or public.current_user_role() = any(allowed_roles::text[])
    or public.is_workflow_officer()
  );

drop policy if exists documents_insert_owner on public.documents;
create policy documents_insert_owner on public.documents
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_governance_admin());

drop policy if exists documents_update_workflow on public.documents;
create policy documents_update_workflow on public.documents
  for update to authenticated
  using (
    user_id = auth.uid()
    or owner_email = (auth.jwt()->>'email')
    or public.is_workflow_officer()
  )
  with check (
    user_id = auth.uid()
    or owner_email = (auth.jwt()->>'email')
    or public.is_workflow_officer()
  );

-- ---------------------------------------------------------------------------
-- 3. DOCUMENT VERSIONS
-- ---------------------------------------------------------------------------
drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select on public.document_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email') or public.is_workflow_officer())
    )
  );

drop policy if exists document_versions_insert on public.document_versions;
create policy document_versions_insert on public.document_versions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email') or public.is_workflow_officer())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. QMS PUBLICATION CONTROL
-- ---------------------------------------------------------------------------
drop policy if exists qms_control_select on public.qms_publication_control;
create policy qms_control_select on public.qms_publication_control
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = qms_publication_control.document_id
        and (
          d.user_id = auth.uid()
          or d.owner_email = (auth.jwt()->>'email')
          or (nullif(d.department, '') is not null and d.department = public.current_user_department())
          or public.is_workflow_officer()
        )
    )
  );

drop policy if exists qms_control_insert on public.qms_publication_control;
create policy qms_control_insert on public.qms_publication_control
  for insert to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = qms_publication_control.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email') or public.is_workflow_officer())
    )
  );

drop policy if exists qms_control_update on public.qms_publication_control;
create policy qms_control_update on public.qms_publication_control
  for update to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = qms_publication_control.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email') or public.is_workflow_officer())
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = qms_publication_control.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email') or public.is_workflow_officer())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. KIPPRA KNOWLEDGE BASE
-- ---------------------------------------------------------------------------
drop policy if exists kb_select_authenticated on public.kippra_knowledge_base;
create policy kb_select_authenticated on public.kippra_knowledge_base
  for select to authenticated
  using (
    'ALL'::text = any(allowed_roles::text[])
    or public.current_user_role() = any(allowed_roles::text[])
    or public.is_governance_admin()
  );

drop policy if exists kb_write_km_admin on public.kippra_knowledge_base;
create policy kb_write_km_admin on public.kippra_knowledge_base
  for all to authenticated
  using (public.current_user_role() in ('DEPUTY_DIRECTOR_KM', 'PUBLICATIONS_EDITOR', 'ADMIN', 'SUPER_ADMIN_VAULT'))
  with check (public.current_user_role() in ('DEPUTY_DIRECTOR_KM', 'PUBLICATIONS_EDITOR', 'ADMIN', 'SUPER_ADMIN_VAULT'));

-- ---------------------------------------------------------------------------
-- 6. COMPLIANCE AUDITS & FINDINGS
-- ---------------------------------------------------------------------------
drop policy if exists audits_select on public.compliance_audits;
create policy audits_select on public.compliance_audits
  for select to authenticated
  using (
    executed_by = auth.uid()
    or public.is_workflow_officer()
    or exists (
      select 1 from public.documents d
      where d.id = compliance_audits.document_id
        and (
          d.user_id = auth.uid()
          or d.owner_email = (auth.jwt()->>'email')
          or (nullif(d.department, '') is not null and d.department = public.current_user_department())
        )
    )
  );

drop policy if exists audits_insert on public.compliance_audits;
create policy audits_insert on public.compliance_audits
  for insert to authenticated
  with check (
    executed_by = auth.uid()
    or public.is_workflow_officer()
    or exists (
      select 1 from public.documents d
      where d.id = compliance_audits.document_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email'))
    )
  );

drop policy if exists findings_select on public.compliance_findings;
create policy findings_select on public.compliance_findings
  for select to authenticated
  using (
    public.is_workflow_officer()
    or exists (
      select 1 from public.compliance_audits a
      join public.documents d on d.id = a.document_id
      where a.id = compliance_findings.audit_id
        and (
          d.user_id = auth.uid()
          or d.owner_email = (auth.jwt()->>'email')
          or (nullif(d.department, '') is not null and d.department = public.current_user_department())
        )
    )
  );

drop policy if exists findings_insert on public.compliance_findings;
create policy findings_insert on public.compliance_findings
  for insert to authenticated
  with check (
    public.is_workflow_officer()
    or exists (
      select 1 from public.compliance_audits a
      join public.documents d on d.id = a.document_id
      where a.id = compliance_findings.audit_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email'))
    )
  );

drop policy if exists findings_update on public.compliance_findings;
create policy findings_update on public.compliance_findings
  for update to authenticated
  using (
    public.is_workflow_officer()
    or exists (
      select 1 from public.compliance_audits a
      join public.documents d on d.id = a.document_id
      where a.id = compliance_findings.audit_id
        and (d.user_id = auth.uid() or d.owner_email = (auth.jwt()->>'email'))
    )
  );

-- ---------------------------------------------------------------------------
-- 7. GUARDIAN CHAT SESSIONS & MESSAGES
-- ---------------------------------------------------------------------------
drop policy if exists chat_sessions_owner on public.chat_sessions;
create policy chat_sessions_owner on public.chat_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_governance_admin())
  with check (user_id = auth.uid() or public.is_governance_admin());

drop policy if exists chat_messages_owner on public.chat_messages;
create policy chat_messages_owner on public.chat_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and (s.user_id = auth.uid() or public.is_governance_admin())
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id
        and (s.user_id = auth.uid() or public.is_governance_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- 8. SYSTEM AUDIT LOGS (APPEND-ONLY)
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_select on public.system_audit_logs;
create policy audit_logs_select on public.system_audit_logs
  for select to authenticated
  using (
    actor_id = auth.uid()
    or actor_email = (auth.jwt()->>'email')
    or public.current_user_role() in ('EXECUTIVE_DIRECTOR', 'ADMIN', 'SUPER_ADMIN_VAULT', 'HOD', 'DIRECTOR')
  );

drop policy if exists audit_logs_insert on public.system_audit_logs;
create policy audit_logs_insert on public.system_audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- ---------------------------------------------------------------------------
-- 9. VAULT (BREAK-GLASS SESSIONS & KEY SHARES)
-- ---------------------------------------------------------------------------
drop policy if exists break_glass_vault on public.break_glass_sessions;
create policy break_glass_vault on public.break_glass_sessions
  for all to authenticated
  using (public.is_governance_admin())
  with check (public.is_governance_admin());

drop policy if exists key_shares_vault on public.key_shares;
create policy key_shares_vault on public.key_shares
  for all to authenticated
  using (public.is_governance_admin())
  with check (public.is_governance_admin());

-- ---------------------------------------------------------------------------
-- 10. PRIVATE STORAGE BUCKET POLICIES
-- ---------------------------------------------------------------------------
drop policy if exists styleguard_storage_read on storage.objects;
create policy styleguard_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id in ('manuscripts', 'revisions', 'compliance-reports', 'tor-benchmarks', 'kippra-e-repository')
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.is_workflow_officer()
    )
  );

drop policy if exists styleguard_storage_insert on storage.objects;
create policy styleguard_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('manuscripts', 'revisions', 'compliance-reports', 'tor-benchmarks', 'kippra-e-repository')
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.is_workflow_officer()
    )
  );

drop policy if exists styleguard_storage_update on storage.objects;
create policy styleguard_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('manuscripts', 'revisions', 'compliance-reports', 'tor-benchmarks', 'kippra-e-repository')
    and (
      owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.is_governance_admin()
    )
  );
-- ============================================================================
-- KIPPRA StyleGuard — ground-truth standards Guardian audits against
-- House Style Manual (2010), PP 06/2020, and the QMS control form.
-- Safe to run repeatedly (existing rules are never duplicated).
-- ============================================================================

insert into public.kippra_knowledge_base
  (source_type, source_uri, section_category, rule_identifier, rule_title,
   rule_content, applicable_paper_types, severity_default, allowed_roles, manual_reference)
select v.source_type, v.source_uri, v.section_category, v.rule_identifier, v.rule_title,
       v.rule_content, v.applicable_paper_types, v.severity_default, array['ALL'], v.manual_reference
from (values
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-CHECKLIST-11', '-ize spelling except the 31 whitelisted -ise verbs',
    'KIPPRA uses British English with the Oxford -ize spelling by default (organize, standardize, utilize, recognize). Thirty-one verbs keep -ise and must not be anglicised: advertise, advise, analyse, apprise, arise, chastise, comprise, compromise, demise, despise, devise, disfranchise, disguise, enfranchise, enterprise, excise, exercise, exorcise, improvise, incise, paralyse, premise, prise, promise, raise, revise, rise, supervise, surmise, surprise, televise.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, pp. 21-24'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'TABLES_AND_FIGURES',
    'KIPPRA-HS-CHECKLIST-42', 'Thousands separated by spaces, not commas',
    'In tables and in body text, numbers of four or more figures use spaces instead of commas (1 405 724, not 1,405,724). Cells with no observation are filled with n.a. (data not available) and nil or negligible values with an en dash.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 42'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-CHECKLIST-38', '"per cent" in text, % only in tables',
    'Write "per cent" in running text and reserve the % sign for tables, figures and technical annexes. Percentages always take a numeral (5 per cent), never a spelled-out number.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 38'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING',
    'KIPPRA-HS-BIAS-02', 'Avoid sexist and racist language',
    'Use inclusive, non-discriminatory language throughout. Prefer gender-neutral occupational terms (chairperson, spokesperson, staff), avoid stereotyping any group, and never attribute characteristics to ethnicity, sex, disability, religion or age.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, pp. 31-32'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'CITATIONS_AND_BIBLIOGRAPHY',
    'KIPPRA-HS-CHECKLIST-54', 'Every in-text citation appears in the bibliography',
    'Each author-date citation in the text must appear in the bibliography and vice versa. Missing entries are a citation parity failure that undermines the evidential basis of the paper.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 54'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'CITATIONS_AND_BIBLIOGRAPHY',
    'KIPPRA-HS-CHECKLIST-56', 'Bibliography entries are cited in text (1:1 parity)',
    'Bibliography entries that are never cited in the text are removed or cited. The bibliography must be an exact mirror of the evidence used.',
    array['ALL'], 'INFO', 'House Style Manual 2010, checklist item 56'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'LAYOUT_AND_FRONT_MATTER',
    'KIPPRA-HS-CHECKLIST-04', 'Abstract in the front matter',
    'Every publication opens with an abstract of 200 to 350 words stating the problem, method and principal finding, followed by keywords. A paper without an abstract is not ready for review.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 4'
  ),
  (
    'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'TABLES_AND_FIGURES',
    'KIPPRA-HS-CHECKLIST-29', 'Tables and figures are numbered, titled and sourced',
    'Every table and figure carries a sequential number, a descriptive title above the exhibit, and a source note beneath it. Un-titled or un-sourced exhibits are returned to the author.',
    array['ALL'], 'WARNING', 'House Style Manual 2010, checklist item 29'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-PRIN-03', 'Prohibition of "shall" in policy statements',
    'Policy is an authoritative decision of government, not an intention or a promise. Do not use "shall" in policy statements; use active voice with "will", "must" or "is responsible for".',
    array['Policy Paper','Policy Memoranda','Policy Brief','Special Paper','Policy Monitor','KIPPRA Policy Monitor'],
    'CRITICAL', 'PP 06/2020, Principle 3'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-PLAN-15', 'Fifteen-year planning horizon',
    'Public policy documents must take a long-range, futuristic perspective exceeding 15 years (Kenya Vision 2030). Scopes of four to six years describe Medium-Term Development Plans, not long-range public policy.',
    array['Policy Paper','Policy Memoranda','Special Paper','Policy Monitor','KIPPRA Policy Monitor'],
    'WARNING', 'PP 06/2020, planning horizon'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-APP-02', 'Mandatory 7-part Cabinet Memorandum structure',
    'Cabinet Memoranda follow the seven-part structure: Part 1 Purpose and objectives (for decision or for information); Part 2 Background information; Part 3 Analysis of the problem; Part 4 Options and the way forward; Part 5 Financial implications (National Treasury concurrence); Part 6 Legal implications (Attorney General concurrence); Part 7 Request to the Cabinet.',
    array['Policy Memoranda'], 'CRITICAL', 'PP 06/2020, Annex 2'
  ),
  (
    'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR',
    'PP062020-EVID-06', 'Options must carry an appraisal',
    'Every policy option presented must be appraised against cost, feasibility, distributional impact and alignment with national development priorities, and a preferred option must be stated with reasons. Options presented without appraisal do not meet policy drafting rigour.',
    array['Policy Paper','Policy Memoranda','Policy Brief','Policy Monitor','KIPPRA Policy Monitor'],
    'WARNING', 'PP 06/2020, options appraisal'
  ),
  (
    'QMS_CONTROL_FORM', 'KIPPRA_QMS_RPC_2023_03.pdf', 'OUTPUT_ALIGNMENT',
    'KIPPRA-TOR-ALIGN-01', 'Expected research output present in the manuscript',
    'The paper must deliver the outputs committed in its concept note and terms of reference (for example a policy brief, a costing model, an implementation matrix). A promised output that is absent from the draft is a scope failure logged on the QMS control form.',
    array['ALL'], 'WARNING', 'QMS/RPC/2023/03, expected outputs'
  ),
  (
    'QMS_CONTROL_FORM', 'KIPPRA_QMS_RPC_2023_03.pdf', 'LAYOUT_AND_FRONT_MATTER',
    'KIPPRA-QMS-RPC-01', 'Control form sign-offs travel with the draft',
    'The KIPPRA/QMS/RPC/2023/03 control form records the concept presentation, draft presentation, directorate review, Weekly Internal Seminar decision, Executive Director authorisation and Knowledge Management receipt. A draft may not advance a stage until the preceding sign-off is recorded.',
    array['ALL'], 'INFO', 'QMS/RPC/2023/03'
  )
) as v(source_type, source_uri, section_category, rule_identifier, rule_title,
       rule_content, applicable_paper_types, severity_default, manual_reference)
where not exists (
  select 1 from public.kippra_knowledge_base kb where kb.rule_identifier = v.rule_identifier
);