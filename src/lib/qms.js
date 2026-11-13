import { db } from '@/lib/db';
import { logEvent } from '@/lib/auditLog';
import { formalSignature, roleOf } from '@/lib/portals';
import { directorateForDepartment } from '@/lib/orgChart';

const ALLOWED_ROLES = {
  researcher_submit: ['RESEARCHER', 'HOD', 'DIRECTOR'],
  hod_sign_concept: ['HOD'],
  hod_sign_draft: ['HOD'],
  hod_return: ['HOD', 'DIRECTOR'],
  director_review: ['DIRECTOR'],
  director_clear_wis: ['DIRECTOR'],
  seminar_decision: ['SEMINAR_PANEL'],
  decision_communicated: ['DIRECTOR'],
  ed_authorize: ['EXECUTIVE_DIRECTOR'],
  km_receive: ['DEPUTY_DIRECTOR_KM'],
  editorial_update: ['PUBLICATIONS_EDITOR'],
  print_requisition: ['PUBLICATIONS_EDITOR'],
};

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const STAGE_FOR_ACTION = {
  hod_sign_concept: 'CONCEPT_PRESENTED_DEPT',
  hod_sign_draft: 'DRAFT_PRESENTED_DEPT',
  director_review: 'DIRECTOR_REVIEW_COMPLETED',
  director_clear_wis: 'WIS_SCHEDULED',
  decision_communicated: 'DECISION_COMMUNICATED',
  ed_authorize: 'EXECUTIVE_DIRECTOR_AUTHORIZED',
  km_receive: 'KM_RECEIVED',
  print_requisition: 'PRINTING_REQUISITIONED',
};

export async function performTransition({ action, manuscript, control, user, payload = {} }) {
  const actorRole = roleOf(user);
  const isSupervisor = actorRole === 'ADMIN' || actorRole === 'SUPER_ADMIN_VAULT';
  const allowed = ALLOWED_ROLES[action] || [];

  if (!isSupervisor && !allowed.includes(actorRole)) {
    throw new Error(`Your office cannot perform ${action.replace(/_/g, ' ')}.`);
  }

  const signerStamp = formalSignature(user);
  const originDept = manuscript?.department || user?.data?.department || user?.department || '';
  const originDir = manuscript?.directorate || directorateForDepartment(originDept) || user?.data?.directorate || '';

  let controlPatch = {};
  let manuscriptPatch = originDir && !manuscript?.directorate ? { directorate: originDir } : {};
  let summary = '';
  let details = {
    action,
    signer: signerStamp,
    department_of_origin: originDept,
    directorate_of_origin: originDir,
  };

  if (action === 'researcher_submit') {
    if (!manuscript.can_route_to_hod) {
      throw new Error(
        `Compliance threshold not met (score ${Math.round(manuscript.latest_score || 0)}%). Resolve the critical findings to unlock submission.`,
      );
    }
    controlPatch = { current_stage: 'DRAFT_SUBMITTED' };
    manuscriptPatch = { status: 'AWAITING_SIGNOFF', stage: 'DRAFT_SUBMITTED', supervisory_note: '' };
    summary = `Submitted to the Head of Department at ${Math.round(manuscript.latest_score)}% compliance`;
    details = { score: manuscript.latest_score };
  }

  if (action === 'hod_sign_concept') {
    controlPatch = {
      current_stage: 'CONCEPT_PRESENTED_DEPT',
      concept_presentation_date: payload.date || today(),
      concept_hod_signer: signerStamp,
      concept_hod_signed_at: nowIso(),
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'CONCEPT_PRESENTED_DEPT' };
    summary = `Row 5 signed by ${signerStamp} — concept presented (${originDept || 'department'})`;
    details = { ...details, signer: signerStamp, note: payload.note || '' };
  }

  if (action === 'hod_sign_draft') {
    controlPatch = {
      current_stage: 'DRAFT_PRESENTED_DEPT',
      draft_presentation_date: payload.date || today(),
      draft_hod_signer: signerStamp,
      draft_hod_signed_at: nowIso(),
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'DRAFT_PRESENTED_DEPT', status: 'AWAITING_SIGNOFF' };
    summary = `Row 6 signed by ${signerStamp} — draft presented, routed to ${originDir || 'Director'}`;
    details = { ...details, signer: signerStamp, note: payload.note || '' };
  }

  if (action === 'hod_return') {
    if (!payload.note?.trim()) {
      throw new Error('A supervisory note is required to return a paper.');
    }
    controlPatch = { current_stage: 'DRAFT_SUBMITTED' };
    manuscriptPatch = { ...manuscriptPatch, status: 'RETURNED', supervisory_note: payload.note, stage: 'DRAFT_SUBMITTED' };
    summary = `Returned to author by ${signerStamp}`;
    details = { ...details, returned_by: signerStamp, note: payload.note };
  }

  if (action === 'director_review') {
    controlPatch = {
      current_stage: 'DIRECTOR_REVIEW_COMPLETED',
      director_receipt_date: control?.director_receipt_date || payload.date || today(),
      director_review_completed_date: payload.date || today(),
      director_signer: signerStamp,
      director_signed_at: nowIso(),
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'DIRECTOR_REVIEW_COMPLETED' };
    summary = `Row 7 signed by ${signerStamp} — directorate review completed`;
    details = { ...details, signer: signerStamp, horizon_note: payload.note || '' };
  }

  if (action === 'director_clear_wis') {
    controlPatch = {
      current_stage: 'WIS_SCHEDULED',
      cleared_to_wis_date: payload.date || today(),
      director_signer: control?.director_signer || signerStamp,
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'WIS_SCHEDULED' };
    summary = `Row 8 signed by ${signerStamp} — cleared to Weekly Internal Seminar`;
    details = { ...details, signer: signerStamp };
  }

  if (action === 'seminar_decision') {
    if (!['SUBMIT_FOR_PUBLICATION', 'REVISE_SUBMIT_MINOR', 'REVISE_REPRESENT_MAJOR'].includes(payload.decision)) {
      throw new Error('Select one of the three panel decisions.');
    }
    controlPatch = {
      current_stage: payload.decision === 'REVISE_REPRESENT_MAJOR' ? 'DRAFT_SUBMITTED' : 'WIS_COMPLETED',
      wis_presentation_date: payload.date || today(),
      wis_panel_decision: payload.decision,
      wis_rapporteur: payload.rapporteur || signerStamp,
    };
    manuscriptPatch =
      payload.decision === 'REVISE_REPRESENT_MAJOR'
        ? {
            ...manuscriptPatch,
            stage: 'DRAFT_SUBMITTED',
            status: 'RETURNED',
            supervisory_note: payload.note || 'The seminar panel requires a revised presentation.',
          }
        : { ...manuscriptPatch, stage: 'WIS_COMPLETED', status: 'AWAITING_SIGNOFF' };
    summary = `Row 9 signed by ${payload.rapporteur || signerStamp} — ${payload.decision.replace(/_/g, ' ').toLowerCase()}`;
    details = { ...details, decision: payload.decision, note: payload.note || '', rapporteur: payload.rapporteur || signerStamp };
  }

  if (action === 'decision_communicated') {
    controlPatch = {
      current_stage: 'DECISION_COMMUNICATED',
      decision_communicated_date: payload.date || today(),
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'DECISION_COMMUNICATED' };
    summary = `Row 10 signed by ${signerStamp} — seminar decision communicated`;
    details = { ...details, signer: signerStamp, note: payload.note || '' };
  }

  if (action === 'ed_authorize') {
    controlPatch = {
      current_stage: 'EXECUTIVE_DIRECTOR_AUTHORIZED',
      ed_authorization_date: payload.date || today(),
      ed_signer: signerStamp,
      ed_signed_at: nowIso(),
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'EXECUTIVE_DIRECTOR_AUTHORIZED', status: 'APPROVED' };
    summary = `Row 11 authorised by ${signerStamp}`;
    details = { ...details, signer: signerStamp, note: payload.note || '' };
  }

  if (action === 'km_receive') {
    const handle = (payload.handle || `kippra-${manuscript.id.slice(0, 8)}`).trim();
    controlPatch = {
      current_stage: 'KM_RECEIVED',
      km_receipt_date: payload.date || today(),
      km_signer: signerStamp,
      km_signed_at: nowIso(),
      repository_handle: handle,
      knowledge_vectorised: true,
    };
    manuscriptPatch = {
      stage: 'KM_RECEIVED',
      status: 'PUBLISHED',
      isbn: payload.isbn || manuscript.isbn || '',
      repository_uri: `https://repository.kippra.or.ke/handle/${handle}`,
    };
    await db.knowledge.upsertViaServer({
      source_type: 'REPOSITORY',
      source_uri: `https://repository.kippra.or.ke/handle/${handle}`,
      section_category: 'OUTPUT_ALIGNMENT',
      rule_identifier: `REPO-${handle.toUpperCase().slice(0, 20)}`,
      rule_title: manuscript.title,
      rule_content: `${manuscript.title} (${manuscript.paper_type}). ${(manuscript.abstract || manuscript.manuscript_text || '').slice(0, 1200)}`,
      applicable_paper_types: [manuscript.paper_type],
      severity_default: 'INFO',
      manual_reference: 'KIPPRA E-Repository',
    });
    summary = `Row 12 signed — received for publication under handle ${handle}`;
    details = { handle, isbn: payload.isbn || '' };
  }

  if (action === 'editorial_update') {
    const stage = payload.stage || 'EDITORIAL_FIRST_TYPESETTING';
    controlPatch = {
      current_stage: stage,
      ...(payload.typesetting_commenced ? { typesetting_commenced: payload.typesetting_commenced } : {}),
      ...(payload.typesetting_completed ? { typesetting_completed: payload.typesetting_completed } : {}),
      typesetting_conducted_by: payload.typesetting_conducted_by || signerStamp,
      ...(payload.editorial_comments_sent_date ? { editorial_comments_sent_date: payload.editorial_comments_sent_date } : {}),
      ...(payload.editorial_feedback_received_date ? { editorial_feedback_received_date: payload.editorial_feedback_received_date } : {}),
      ...(payload.final_corrections_incorporated_date ? { final_corrections_incorporated_date: payload.final_corrections_incorporated_date } : {}),
    };
    manuscriptPatch = { ...manuscriptPatch, stage };
    summary = `Editorial stage (${stage.replace(/_/g, ' ').toLowerCase()}) recorded by ${signerStamp}`;
    details = { ...details, stage, signer: signerStamp };
  }

  if (action === 'print_requisition') {
    controlPatch = {
      current_stage: 'PRINTING_REQUISITIONED',
      printing_requisition_date: payload.date || today(),
      typesetting_conducted_by: control?.typesetting_conducted_by || signerStamp,
      print_specification: payload.print_specification || control?.print_specification || '',
      is_fully_completed: true,
    };
    manuscriptPatch = { ...manuscriptPatch, stage: 'PRINTING_REQUISITIONED', status: 'PUBLISHED' };
    summary = `Row 13 signed by ${signerStamp} — printing requisitioned and control form closed`;
    details = { ...details, specification: payload.print_specification || '', signer: signerStamp };
  }

  if (STAGE_FOR_ACTION[action] && !controlPatch.current_stage) {
    controlPatch.current_stage = STAGE_FOR_ACTION[action];
  }

  let updatedControl = control;
  if (control?.id) {
    updatedControl = await db.qmsControl.update(control.id, controlPatch);
  } else {
    const existing = await db.qmsControl.getByManuscript(manuscript.id);
    if (existing?.id) {
      updatedControl = await db.qmsControl.update(existing.id, controlPatch);
    } else {
      const created = await db.qmsControl.create(
        {
          manuscript_id: manuscript.id,
          form_ref_no: 'KIPPRA/QMS/RPC/2023/03',
          revision_no: 3,
          current_stage: controlPatch.current_stage || manuscript.stage || 'DRAFT_SUBMITTED',
        },
        user?.id,
      );
      updatedControl = await db.qmsControl.update(created.id, controlPatch);
    }
  }

  if (Object.keys(manuscriptPatch).length) {
    await db.manuscripts.update(manuscript.id, manuscriptPatch);
  }

  await logEvent({
    actionType: action.toUpperCase(),
    user,
    manuscriptId: manuscript.id,
    summary,
    details,
    role: actorRole,
  });

  return { control: updatedControl, summary };
}