import { supabase } from '@/lib/supabaseClient';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}

export async function getAccessToken() {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const mapManuscript = (r) =>
  r
    ? {
        ...r,
        latest_score: r.latest_score != null ? Number(r.latest_score) : null,
        expected_outputs: r.expected_outputs ?? r.expected_research_outputs ?? '',
        file_uri: r.file_uri ?? r.storage_path ?? r.s3_storage_uri ?? '',
        tor_file_uri: r.tor_file_uri ?? r.tor_storage_path ?? r.tor_file_s3_uri ?? '',
        created_date: r.created_at || r.created_date,
        updated_date: r.updated_at || r.updated_date,
      }
    : null;

const mapControl = (r) =>
  r
    ? {
        ...r,
        manuscript_id: r.document_id || r.manuscript_id,
        created_date: r.created_at || r.created_date,
        updated_date: r.updated_at || r.updated_date,
      }
    : null;

const mapAudit = (r) =>
  r
    ? {
        ...r,
        manuscript_id: r.document_id || r.manuscript_id,
        overall_score: r.overall_score != null ? Number(r.overall_score) : 0,
        house_style_score: r.house_style_score != null ? Number(r.house_style_score) : 0,
        policy_rigor_score: r.policy_rigor_score != null ? Number(r.policy_rigor_score) : 0,
        output_alignment_score: r.output_alignment_score != null ? Number(r.output_alignment_score) : 0,
        created_date: r.created_at || r.created_date,
      }
    : null;

const mapFinding = (r) =>
  r
    ? {
        ...r,
        created_date: r.created_at || r.created_date,
      }
    : null;

const mapSession = (r) =>
  r
    ? {
        ...r,
        manuscript_id: r.document_id || '',
        mode: r.current_mode || r.mode || 'GENERAL_CHAT',
        created_by_id: r.user_id,
        created_date: r.created_at || r.created_date,
      }
    : null;

const mapMessage = (r) =>
  r
    ? {
        ...r,
        created_date: r.created_at || r.created_date,
      }
    : null;

const mapAuditLog = (r) =>
  r
    ? {
        ...r,
        created_date: r.created_at || r.created_date,
      }
    : null;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',').pop() || '' : result);
    };
    reader.onerror = () => reject(new Error('Could not read selected file'));
    reader.readAsDataURL(file);
  });
}

export const db = {
  storage: {
    async uploadFile(file, bucket = 'manuscripts') {
      const base64Data = await fileToBase64(file);
      const res = await apiFetch('/api/storage/upload', {
        method: 'POST',
        body: {
          bucket,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
        },
      });
      return res.path;
    },
    async uploadManuscriptFile(file) {
      return this.uploadFile(file, 'manuscripts');
    },
    async uploadTorFile(file) {
      return this.uploadFile(file, 'tor-benchmarks');
    },
    async scanDocument(file, { kind = 'manuscript', fallbackDirectorate = '', fallbackDepartment = '' } = {}) {
      const base64Data = await fileToBase64(file);
      return apiFetch('/api/ai/scan-document', {
        method: 'POST',
        body: {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data,
          kind,
          fallbackDirectorate,
          fallbackDepartment,
        },
      });
    },
    async getSignedUrl(bucket, path, expiresIn = 300) {
      const res = await apiFetch('/api/storage/signed-url', {
        method: 'POST',
        body: { bucket, path, expiresIn },
      });
      return res.signedUrl || '';
    },
  },

  manuscripts: {
    async get(id) {
      const client = requireSupabase();
      const { data, error } = await client.from('documents').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return mapManuscript(data);
    },
    async filterByStages(stages = [], { department, directorate, departments, limit = 40 } = {}) {
      const client = requireSupabase();
      let q = client.from('documents').select('*').order('updated_at', { ascending: false }).limit(limit);
      if (stages.length) q = q.in('stage', stages);
      if (department) q = q.eq('department', department);
      if (Array.isArray(departments) && departments.length && directorate) {
        const deptList = departments.map((d) => `"${d.replace(/"/g, '\\"')}"`).join(',');
        q = q.or(`directorate.eq."${directorate.replace(/"/g, '\\"')}",department.in.(${deptList})`);
      } else if (directorate) {
        q = q.eq('directorate', directorate);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapManuscript);
    },
    async listDepartment(department, { limit = 40 } = {}) {
      const client = requireSupabase();
      if (!department) return [];
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('department', department)
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map(mapManuscript);
    },
    async listMine(user, { limit = 40 } = {}) {
      const client = requireSupabase();
      const clauses = [];
      if (user?.id) clauses.push(`user_id.eq.${user.id}`);
      if (user?.email) clauses.push(`owner_email.eq.${user.email}`);
      let q = client.from('documents').select('*').order('updated_at', { ascending: false }).limit(limit);
      if (clauses.length) q = q.or(clauses.join(','));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapManuscript);
    },
    async intake(payload) {
      const res = await apiFetch('/api/manuscripts/intake', {
        method: 'POST',
        body: payload,
      });
      return {
        manuscript: mapManuscript(res.manuscript),
        control: mapControl(res.control),
      };
    },
    async create(payload, userId) {
      const client = requireSupabase();
      const row = {
        user_id: userId,
        title: payload.title,
        paper_type: payload.paper_type,
        abstract: payload.abstract || '',
        directorate: payload.directorate || '',
        department: payload.department || '',
        original_filename: payload.original_filename || '',
        mime_type: payload.mime_type || 'application/octet-stream',
        storage_path: payload.file_uri || '',
        s3_storage_uri: payload.file_uri || '',
        file_hash_sha256: payload.file_hash_sha256 || '',
        manuscript_text: payload.manuscript_text || '',
        expected_research_outputs: payload.expected_outputs || '',
        tor_text: payload.tor_text || '',
        owner_name: payload.owner_name || '',
        owner_email: payload.owner_email || '',
        stage: payload.stage || 'DRAFT_SUBMITTED',
        status: payload.status || 'IN_AUDIT',
      };
      const { data, error } = await client.from('documents').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return mapManuscript(data);
    },
    async update(id, patch) {
      const client = requireSupabase();
      const clean = { ...patch };
      if ('expected_outputs' in clean) {
        clean.expected_research_outputs = clean.expected_outputs;
        delete clean.expected_outputs;
      }
      if ('file_uri' in clean) {
        clean.storage_path = clean.file_uri;
        clean.s3_storage_uri = clean.file_uri;
        delete clean.file_uri;
      }
      const { data, error } = await client.from('documents').update(clean).eq('id', id).select('*').single();
      if (error) throw new Error(error.message);
      return mapManuscript(data);
    },
  },

  qmsControl: {
    async getByManuscript(manuscriptId) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('qms_publication_control')
        .select('*')
        .eq('document_id', manuscriptId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return mapControl(data);
    },
    async create(payload, userId) {
      const client = requireSupabase();
      const row = {
        document_id: payload.manuscript_id || payload.document_id,
        form_ref_no: payload.form_ref_no || 'KIPPRA/QMS/RPC/2023/03',
        revision_no: payload.revision_no ?? 3,
        current_stage: payload.current_stage || 'DRAFT_SUBMITTED',
        created_by: userId || null,
      };
      const { data, error } = await client.from('qms_publication_control').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return mapControl(data);
    },
    async update(id, patch) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('qms_publication_control')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapControl(data);
    },
  },

  audits: {
    async get(id) {
      const client = requireSupabase();
      const { data, error } = await client.from('compliance_audits').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return mapAudit(data);
    },
    async list({ limit = 20 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('compliance_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map(mapAudit);
    },
    async create(payload, userId) {
      const client = requireSupabase();
      const row = {
        document_id: payload.manuscript_id || payload.document_id,
        version_id: payload.version_id || null,
        version_number: payload.version_number ?? 1,
        overall_score: payload.overall_score,
        house_style_score: payload.house_style_score,
        policy_rigor_score: payload.policy_rigor_score,
        output_alignment_score: payload.output_alignment_score,
        audit_status: payload.audit_status || 'COMPLETED',
        can_route_to_hod: Boolean(payload.can_route_to_hod),
        executive_summary: payload.executive_summary || '',
        priority_actions: payload.priority_actions || [],
        qualities: payload.qualities || [],
        citation_parity: payload.citation_parity || {},
        agent_trace: payload.agent_trace || [],
        findings_total: payload.findings_total ?? 0,
        findings_critical: payload.findings_critical ?? 0,
        findings_warning: payload.findings_warning ?? 0,
        word_count: payload.word_count ?? 0,
        inference_engine: payload.inference_engine || 'Guardian editorial assistant',
        executed_by: userId || null,
        executed_by_email: payload.executed_by_email || '',
      };
      const { data, error } = await client.from('compliance_audits').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return mapAudit(data);
    },
  },

  findings: {
    async filterByAudit(auditId, { limit = 120 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('compliance_findings')
        .select('*')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map(mapFinding);
    },
    async filterByRule(ruleIdentifier, { limit = 40 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('compliance_findings')
        .select('*')
        .eq('rule_identifier', ruleIdentifier)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map(mapFinding);
    },
    async bulkCreate(items) {
      const client = requireSupabase();
      if (!items.length) return [];
      const rows = items.map((f) => ({
        audit_id: f.audit_id,
        manuscript_id: f.manuscript_id || null,
        vector_category: f.vector_category,
        rule_identifier: f.rule_identifier,
        rule_title: f.rule_title || '',
        severity: f.severity,
        issue_detected: f.issue_detected,
        original_text_excerpt: f.original_text_excerpt || '',
        suggested_correction: f.suggested_correction || '',
        character_start: f.character_start ?? null,
        character_end: f.character_end ?? null,
        status: f.status || 'OPEN',
      }));
      const { data, error } = await client.from('compliance_findings').insert(rows).select('*');
      if (error) throw new Error(error.message);
      return (data || []).map(mapFinding);
    },
    async update(id, patch) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('compliance_findings')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapFinding(data);
    },
  },

  versions: {
    async listForDocument(documentId, { limit = 50 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },
    async create(payload, userId) {
      const client = requireSupabase();
      const row = {
        document_id: payload.manuscript_id || payload.document_id,
        version_number: payload.version_number,
        version_hash_sha256: payload.version_hash_sha256,
        storage_path: payload.storage_path || '',
        s3_storage_uri: payload.s3_storage_uri || '',
        text_snapshot: payload.text_snapshot || '',
        change_summary: payload.change_summary || '',
        created_by: userId || null,
        created_by_email: payload.created_by_email || '',
      };
      const { data, error } = await client.from('document_versions').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
  },

  knowledge: {
    async list({ limit = 24 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('kippra_knowledge_base')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },
    async upsertViaServer(payload) {
      return apiFetch('/api/kb/upsert', { method: 'POST', body: payload });
    },
  },

  chat: {
    async listSessions({ userId, limit = 20 } = {}) {
      const client = requireSupabase();
      let q = client.from('chat_sessions').select('*').order('created_at', { ascending: false }).limit(limit);
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapSession);
    },
    async createSession({ userId, manuscriptId, mode, title }) {
      const client = requireSupabase();
      const row = {
        user_id: userId,
        document_id: manuscriptId || null,
        current_mode: mode || 'GENERAL_CHAT',
        title: title || 'Guardian session',
      };
      const { data, error } = await client.from('chat_sessions').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return mapSession(data);
    },
    async loadMessages(sessionId, { limit = 100 } = {}) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map(mapMessage);
    },
    async createMessage({ sessionId, sender, content }) {
      const client = requireSupabase();
      const { data, error } = await client
        .from('chat_messages')
        .insert({ session_id: sessionId, sender, content })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapMessage(data);
    },
  },

  auditLogs: {
    async list({ manuscriptId, ascending = false, limit = 100 } = {}) {
      const client = requireSupabase();
      let q = client
        .from('system_audit_logs')
        .select('*')
        .order('created_at', { ascending })
        .limit(limit);
      if (manuscriptId) q = q.eq('manuscript_id', manuscriptId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapAuditLog);
    },
  },

  vault: {
    async listShares() {
      const client = requireSupabase();
      const { data, error } = await client
        .from('key_shares')
        .select('*')
        .order('share_index', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data || [];
    },
    async deactivateShare(id) {
      const client = requireSupabase();
      const { error } = await client.from('key_shares').update({ is_active: false }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    async createShare(payload) {
      const client = requireSupabase();
      const { data, error } = await client.from('key_shares').insert(payload).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    async listSessions() {
      const client = requireSupabase();
      const { data, error } = await client
        .from('break_glass_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data || [];
    },
    async createSession(payload) {
      const client = requireSupabase();
      const { data, error } = await client.from('break_glass_sessions').insert(payload).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
};
