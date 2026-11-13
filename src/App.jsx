-- ==============================================================================
-- KIPPRA STYLEGUARD: PRODUCTION DDL MIGRATION
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. USERS & CLEARANCES
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'RESEARCHER', 'HOD', 'DIRECTOR', 'SEMINAR_PANEL',
        'EXECUTIVE_DIRECTOR', 'DEPUTY_DIRECTOR_KM', 'PUBLICATIONS_EDITOR',
        'ADMIN', 'SUPER_ADMIN_VAULT'
    )),
    directorate VARCHAR(150) NOT NULL,
    department VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title VARCHAR(500) NOT NULL,
    paper_type VARCHAR(100) NOT NULL CHECK (paper_type IN (
        'Discussion Paper', 'Kenya Economic Report', 'Policy Brief', 'Policy Monitor',
        'Special Paper', 'Policy Memoranda', 'Policy Paper', 'Working Paper',
        'Research Paper', 'Occasional Paper', 'Media Article'
    )),
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    file_hash_sha256 CHAR(64) NOT NULL,
    expected_research_outputs TEXT NOT NULL,
    tor_storage_path VARCHAR(1024),
    allowed_roles VARCHAR[] DEFAULT '{"RESEARCHER", "HOD", "DIRECTOR", "ADMIN"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. DOCUMENT VERSIONS (OPTIMISTIC CONCURRENCY CONTROL)
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    version_hash_sha256 CHAR(64) NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    diff_ast_patch JSONB,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doc_version UNIQUE (document_id, version_number)
);

-- 5. QMS CONTROL LIFECYCLE (KIPPRA/QMS/RPC/2023/03 Revision 3)
CREATE TABLE IF NOT EXISTS public.qms_publication_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    form_ref_no VARCHAR(100) DEFAULT 'KIPPRA/QMS/RPC/2023/03',
    revision_no INT DEFAULT 3,
    current_stage VARCHAR(100) NOT NULL CHECK (current_stage IN (
        'DRAFT_SUBMITTED', 'CONCEPT_PRESENTED_DEPT', 'DRAFT_PRESENTED_DEPT',
        'DIRECTOR_REVIEW_COMPLETED', 'WIS_SCHEDULED', 'WIS_COMPLETED',
        'DECISION_COMMUNICATED', 'EXECUTIVE_DIRECTOR_AUTHORIZED',
        'KM_RECEIVED', 'EDITORIAL_FIRST_TYPESETTING', 'EDITORIAL_SECOND_REVIEW',
        'AUTHOR_FEEDBACK_CYCLE', 'FINAL_CORRECTIONS_INCORPORATED', 'PRINTING_REQUISITIONED'
    )),
    concept_presentation_date DATE,
    concept_hod_signoff_user UUID REFERENCES public.users(id),
    concept_hod_signed_at TIMESTAMP WITH TIME ZONE,
    draft_presentation_date DATE,
    draft_hod_signoff_user UUID REFERENCES public.users(id),
    draft_hod_signed_at TIMESTAMP WITH TIME ZONE,
    director_receipt_date DATE,
    director_review_completed_date DATE,
    director_signoff_user UUID REFERENCES public.users(id),
    director_signed_at TIMESTAMP WITH TIME ZONE,
    wis_presentation_date DATE,
    wis_director_signoff_user UUID REFERENCES public.users(id),
    wis_panel_decision VARCHAR(50) CHECK (wis_panel_decision IN (
        'SUBMIT_FOR_PUBLICATION', 
        'REVISE_SUBMIT_MINOR', 
        'REVISE_REPRESENT_MAJOR'
    )),
    decision_communicated_date DATE,
    ed_authorization_date DATE,
    ed_signoff_user UUID REFERENCES public.users(id),
    km_receipt_date DATE,
    km_signoff_user UUID REFERENCES public.users(id),
    typesetting_commenced DATE,
    typesetting_completed DATE,
    typesetting_conducted_by VARCHAR(255),
    editorial_comments_sent_date DATE,
    editorial_feedback_received_date DATE,
    final_corrections_incorporated_date DATE,
    printing_requisition_date DATE,
    is_fully_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. HYBRID KNOWLEDGE BASE (1536-DIM VECTOR FOR HNSW + BM25)
CREATE TABLE IF NOT EXISTS public.kippra_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(100) NOT NULL,
    source_uri VARCHAR(1024) NOT NULL,
    section_category VARCHAR(100) NOT NULL,
    rule_identifier VARCHAR(100) NOT NULL,
    rule_title VARCHAR(255) NOT NULL,
    rule_content TEXT NOT NULL,
    applicable_paper_types VARCHAR[] NOT NULL,
    allowed_roles VARCHAR[] DEFAULT '{"ALL"}',
    embedding vector(1536), -- Truncated MRL text-embedding-3-large or text-embedding-3-small
    tsv_content tsvector,
    metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure tsvector is automatically updated on insert/update
CREATE OR REPLACE FUNCTION kippra_kb_tsv_update() RETURNS trigger AS $$
BEGIN
    new.tsv_content := to_tsvector('english', coalesce(new.rule_title, '') || ' ' || coalesce(new.rule_content, ''));
    RETURN new;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_kippra_kb_tsv
BEFORE INSERT OR UPDATE ON public.kippra_knowledge_base
FOR EACH ROW EXECUTE FUNCTION kippra_kb_tsv_update();

CREATE INDEX IF NOT EXISTS idx_kb_embedding ON public.kippra_knowledge_base USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_kb_tsv ON public.kippra_knowledge_base USING gin (tsv_content);
CREATE INDEX IF NOT EXISTS idx_kb_paper_types ON public.kippra_knowledge_base USING gin (applicable_paper_types);

-- 7. COMPLIANCE AUDITS & FINDINGS
CREATE TABLE IF NOT EXISTS public.compliance_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
    overall_score NUMERIC(5, 2) NOT NULL,
    house_style_score NUMERIC(5, 2) NOT NULL,
    policy_rigor_score NUMERIC(5, 2) NOT NULL,
    output_alignment_score NUMERIC(5, 2) NOT NULL,
    audit_status VARCHAR(50) NOT NULL CHECK (audit_status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    can_route_to_hod BOOLEAN DEFAULT FALSE,
    executive_summary TEXT,
    executed_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.compliance_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.compliance_audits(id) ON DELETE CASCADE,
    rule_identifier VARCHAR(100),
    vector_category VARCHAR(50) NOT NULL CHECK (vector_category IN (
        'LAYOUT_AND_FRONT_MATTER', 'STYLE_AND_SPELLING', 'TABLES_AND_FIGURES',
        'CITATIONS_AND_BIBLIOGRAPHY', 'POLICY_DRAFTING_RIGOR', 'OUTPUT_ALIGNMENT'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    issue_detected TEXT NOT NULL,
    original_text_excerpt TEXT,
    suggested_correction TEXT,
    page_number INT,
    character_range INT[],
    status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACCEPTED', 'REJECTED'))
);

-- 8. CHAT SESSIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    current_mode VARCHAR(50) NOT NULL CHECK (current_mode IN ('GENERAL_CHAT', 'PAPER_EVALUATION', 'CO_PILOT_EDIT')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('USER', 'AGENT', 'SYSTEM')),
    content TEXT NOT NULL,
    mcp_tool_calls JSONB,
    ui_visualizations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. IMMUTABLE WORM AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action_type VARCHAR(100) NOT NULL,
    ip_address INET NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.system_audit_logs(created_at);

-- Prevent update/delete on audit logs (True WORM compliance)
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'System audit logs are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_audit_log_immutability
BEFORE UPDATE OR DELETE ON public.system_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- 10. HYBRID RETRIEVAL RPC FUNCTION
CREATE OR REPLACE FUNCTION match_kippra_rules(
    query_embedding vector(1536),
    query_text text,
    target_paper_type text,
    match_count int
)
RETURNS TABLE (
    id uuid,
    rule_identifier varchar,
    rule_title varchar,
    rule_content text,
    section_category varchar,
    combined_score float
)
LANGUAGE sql STABLE AS $$
    SELECT 
        id, 
        rule_identifier, 
        rule_title, 
        rule_content,
        section_category,
        ((1 - (embedding <=> query_embedding)) * 0.70 + 
         ts_rank_cd(tsv_content, plainto_tsquery('english', query_text)) * 0.30)::float AS combined_score
    FROM public.kippra_knowledge_base
    WHERE applicable_paper_types @> ARRAY[target_paper_type]
       OR applicable_paper_types @> ARRAY['ALL']
    ORDER BY combined_score DESC
    LIMIT match_count;
$$;

3. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL

Enable RLS on all tables and apply strict security boundaries:

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qms_publication_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kippra_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Knowledge base is readable by all authenticated users
CREATE POLICY "Allow authenticated read of KB" 
ON public.kippra_knowledge_base FOR SELECT TO authenticated USING (true);

-- Researchers manage their own documents; Supervisors/HODs view department papers
CREATE POLICY "Users access permitted documents" 
ON public.documents FOR ALL TO authenticated 
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('HOD', 'DIRECTOR', 'SEMINAR_PANEL', 'EXECUTIVE_DIRECTOR', 'ADMIN')
    )
);

-- QMS Control Form visible to document owners and review chain
CREATE POLICY "QMS workflow access" 
ON public.qms_publication_control FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.documents 
        WHERE documents.id = qms_publication_control.document_id 
        AND (documents.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('HOD', 'DIRECTOR', 'SEMINAR_PANEL', 'EXECUTIVE_DIRECTOR', 'PUBLICATIONS_EDITOR', 'ADMIN')
        ))
    )
);

-- Append-only policy for system audit logs
CREATE POLICY "Allow system insert into audit logs" 
ON public.system_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admins to read audit logs" 
ON public.system_audit_logs FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN_VAULT')
    )
);

4. SUPABASE STORAGE BUCKETS SETUP

Using the SUPABASE_SERVICE_ROLE_KEY or Supabase Storage API, programmatically
provision the following private storage buckets:

1.  manuscripts: Stores uploaded original files (.docx, .pdf, .zip, .xlsx).
2.  revisions: Stores patched .docx files containing native Word Track Changes.
3.  compliance-reports: Stores compiled PDF and DOCX evaluation scorecards.
4.  tor-benchmarks: Stores uploaded terms-of-reference and expected research
    outputs.
5.  kippra-e-repository: Stores ingested guidelines and harvested publications.

-- Storage bucket initialization (via Storage schema)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('manuscripts', 'manuscripts', false),
    ('revisions', 'revisions', false),
    ('compliance-reports', 'compliance-reports', false),
    ('tor-benchmarks', 'tor-benchmarks', false),
    ('kippra-e-repository', 'kippra-e-repository', false)
ON CONFLICT (id) DO NOTHING;

5. SEED INITIAL KNOWLEDGE BASE & TEST PROFILES

Execute the following seed query to ground Guardian in KIPPRA’s core rules and
initialize test profiles for all roles:

-- 1. SEED CORE RULES INTO KNOWLEDGE BASE
INSERT INTO public.kippra_knowledge_base 
    (source_type, source_uri, section_category, rule_identifier, rule_title, rule_content, applicable_paper_types)
VALUES 
    (
        'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'STYLE_AND_SPELLING', 
        'KIPPRA-HS-RULE-01', 'Oxford -ize Default and 31 -ise Exceptions', 
        'KIPPRA uses British English with the Oxford -ize spelling by default (e.g., organize, standardize, utilize). However, 31 verbs retain -ise: advertise, advise, analyse, apprise, chastise, comprise, compromise, demise, despise, devise, disfranchise, disguise, enfranchise, enterprise, excise, exercise, exorcise, improvise, incise, paralyse, premise, prise, promise, raise, revise, rise, arise, supervise, surmise, surprise, televise.', 
        ARRAY['ALL']
    ),
    (
        'HOUSE_STYLE_2010', 'House_Style_Manual_2010.pdf', 'TABLES_AND_FIGURES', 
        'KIPPRA-HS-CHECKLIST-42', 'Table Number Thousands Separators', 
        'In tables, numbers consisting of four or more figures must use spaces instead of commas (e.g., 1 405 724 not 1,405,724). Blanks must be populated with n.a. (data not available) or – (nil/negligible).', 
        ARRAY['ALL']
    ),
    (
        'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR', 
        'PP062020-PRIN-03', 'Prohibition of Shall in Policy Statements', 
        'Policy is an authoritative decision of government, not an intention or promise. Do not use "shall" in policy statements. Use active voice with "will", "must", or "is responsible for".', 
        ARRAY['Policy Paper', 'Policy Memoranda', 'Policy Brief', 'Special Paper']
    ),
    (
        'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'POLICY_DRAFTING_RIGOR', 
        'PP062020-PRIN-08', 'Long-Range 15-Year Planning Horizon', 
        'Public policy documents must take a long-range, futuristic perspective exceeding 15 years (e.g., Kenya Vision 2030). Scopes of 4 to 6 years define Medium-Term Development Plans (MTPs), not long-range public policies.', 
        ARRAY['Policy Paper', 'Policy Memoranda']
    ),
    (
        'POLICY_GUIDELINES_PP062020', 'PP_06_2020.pdf', 'CABINET_MEMO', 
        'PP062020-APP-02', 'Mandatory 7-Part Cabinet Memo Structure', 
        'Cabinet Memoranda must adhere strictly to the 7-part format: Part 1: Purpose/Objectives (For Decision vs For Information); Part 2: Background Information; Part 3: Analysis of the Problem; Part 4: Options and the Way Forward; Part 5: Financial Implications (National Treasury concurrence); Part 6: Legal Implications (Attorney General concurrence); Part 7: Request to the Cabinet.', 
        ARRAY['Policy Memoranda']
    )
ON CONFLICT DO NOTHING;

6. CLIENT INTEGRATION & CONNECTION HANDSHAKE

In the frontend application, instantiate the Supabase client using @supabase/ssr
or @supabase/supabase-js:

// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

Ensure all file uploads, intake form submissions, and QMS status transitions
write directly to these tables. Do not use mock handlers or local storage.

7. EXECUTION DIRECTIVE

Connect to the remote Supabase project now. Apply the DDL migration, verify
extension activations (uuid-ossp, pgcrypto, vector), set up storage buckets and
RLS policies, seed the initial knowledge base rules, and verify database
connectivity. Build a fully functioning backend integration.


***