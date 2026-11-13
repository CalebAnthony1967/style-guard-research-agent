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