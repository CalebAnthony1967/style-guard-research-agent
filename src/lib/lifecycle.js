/**
 * The publication lifecycle in the six stages officers actually work in.
 * Internal record stages are grouped under the phase an officer recognises.
 */
export const PHASES = [
  {
    key: 'intake',
    title: 'Submission & quality check',
    short: 'Submission',
    description: 'The author submits the paper. Guardian reviews it against the KIPPRA publication standards before anyone else reads it.',
    stages: ['DRAFT_SUBMITTED'],
    owner: 'Author',
    next: 'Clear every critical issue, then submit the paper to your Head of Department for concept review.',
  },
  {
    key: 'department',
    title: 'Departmental presentation',
    short: 'Department',
    description: 'The Head of Department receives the concept and the draft, and records the departmental presentation.',
    stages: ['CONCEPT_PRESENTED_DEPT', 'DRAFT_PRESENTED_DEPT'],
    owner: 'Head of Department',
    next: 'Approve the concept presentation, then approve the draft presentation.',
  },
  {
    key: 'directorate',
    title: 'Directorate review',
    short: 'Directorate',
    description: 'The Division Director completes the technical review and clears the paper for the Weekly Internal Seminar.',
    stages: ['DIRECTOR_REVIEW_COMPLETED', 'WIS_SCHEDULED'],
    owner: 'Director',
    next: 'Record the completed review, then clear the paper to the seminar.',
  },
  {
    key: 'seminar',
    title: 'Weekly Internal Seminar',
    short: 'Seminar',
    description: 'The panel evaluates the paper and records one binding decision: publish, revise minor, or revise and present again.',
    stages: ['WIS_COMPLETED', 'DECISION_COMMUNICATED'],
    owner: 'Seminar panel',
    next: 'Record the panel decision and confirm that it has been communicated to the author.',
  },
  {
    key: 'authorisation',
    title: 'Executive authorisation & knowledge intake',
    short: 'Clearance',
    description: 'The Executive Director authorises publication and Knowledge Management receives the title with its handle and ISBN.',
    stages: ['EXECUTIVE_DIRECTOR_AUTHORIZED', 'KM_RECEIVED'],
    owner: 'Executive Director / KM',
    next: 'Sign the authorisation, then receive the publication into the repository.',
  },
  {
    key: 'production',
    title: 'Editorial & printing',
    short: 'Production',
    description: 'Typesetting, author feedback and final corrections, closing with the printing requisition.',
    stages: ['EDITORIAL_FIRST_TYPESETTING', 'EDITORIAL_SECOND_REVIEW', 'AUTHOR_FEEDBACK_CYCLE', 'FINAL_CORRECTIONS_INCORPORATED', 'PRINTING_REQUISITIONED'],
    owner: 'Publications',
    next: 'Record each editorial stage and raise the printing requisition when the paper is camera-ready.',
  },
];

export const SIGN_OFFS = [
  { label: 'Concept presented to department', signerKey: 'concept_hod_signer', dateKey: 'concept_presentation_date', phase: 'department' },
  { label: 'Draft presented to department', signerKey: 'draft_hod_signer', dateKey: 'draft_presentation_date', phase: 'department' },
  { label: 'Directorate review completed', signerKey: 'director_signer', dateKey: 'director_review_completed_date', phase: 'directorate' },
  { label: 'Cleared to Weekly Internal Seminar', signerKey: 'director_signer', dateKey: 'cleared_to_wis_date', phase: 'directorate' },
  { label: 'Seminar panel decision', signerKey: 'wis_rapporteur', dateKey: 'wis_presentation_date', phase: 'seminar' },
  { label: 'Decision communicated to author', signerKey: 'wis_rapporteur', dateKey: 'decision_communicated_date', phase: 'seminar' },
  { label: 'Authorised for publication', signerKey: 'ed_signer', dateKey: 'ed_authorization_date', phase: 'authorisation' },
  { label: 'Received by Knowledge Management', signerKey: 'km_signer', dateKey: 'km_receipt_date', phase: 'authorisation' },
  { label: 'Printing requisitioned', signerKey: 'typesetting_conducted_by', dateKey: 'printing_requisition_date', phase: 'production' },
];

export const phaseForStage = (stage) => {
  const index = PHASES.findIndex((p) => p.stages.includes(stage));
  return index === -1 ? 0 : index;
};

export const phaseFor = (key) => PHASES.find((p) => p.key === key);

export const phaseLabel = (stage) => PHASES[phaseForStage(stage)]?.title || 'Submission & quality check';

/** A human readable label for a stored stage value. */
export const stageText = (stage) => {
  const phase = PHASES[phaseForStage(stage)];
  return stage === 'PRINTING_REQUISITIONED' ? 'Printing requisitioned' : phase?.short || 'Submission';
};

export const PANEL_DECISIONS = {
  SUBMIT_FOR_PUBLICATION: 'Submit for publication',
  REVISE_SUBMIT_MINOR: 'Revise — minor comments',
  REVISE_REPRESENT_MAJOR: 'Revise — major comments',
};