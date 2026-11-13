import {
  PenLine,
  ClipboardCheck,
  Building2,
  Presentation,
  Stamp,
  Archive,
  Printer,
  Settings,
  LockKeyhole,
} from 'lucide-react';
import { firstNameOf, twoNamesOf } from '@/lib/orgChart';

export const PAPER_TYPES = [
  'Discussion Paper',
  'Working Paper',
  'Policy Paper',
  'Policy Brief',
  'Policy Memoranda',
  'Kenya Economic Report',
  'KIPPRA Policy Monitor',
  'Special Paper',
  'Occasional Paper',
  'Research Paper',
  'Media Article',
];

export const STAGES = [
  { key: 'DRAFT_SUBMITTED', label: 'Draft submitted', owner: 'AUTHOR' },
  { key: 'CONCEPT_PRESENTED_DEPT', label: 'Concept presented to department', owner: 'HEAD OF DEPARTMENT' },
  { key: 'DRAFT_PRESENTED_DEPT', label: 'Draft presented to department', owner: 'HEAD OF DEPARTMENT' },
  { key: 'DIRECTOR_REVIEW_COMPLETED', label: 'Directorate review completed', owner: 'DIRECTOR' },
  { key: 'WIS_SCHEDULED', label: 'Cleared to the Weekly Internal Seminar', owner: 'DIRECTOR' },
  { key: 'WIS_COMPLETED', label: 'Seminar decision recorded', owner: 'SEMINAR PANEL' },
  { key: 'DECISION_COMMUNICATED', label: 'Decision communicated to the author', owner: 'DIRECTOR' },
  { key: 'EXECUTIVE_DIRECTOR_AUTHORIZED', label: 'Authorised for publication', owner: 'EXECUTIVE DIRECTOR' },
  { key: 'KM_RECEIVED', label: 'Received by Knowledge Management', owner: 'KNOWLEDGE MANAGEMENT' },
  { key: 'EDITORIAL_FIRST_TYPESETTING', label: 'First editing and typesetting', owner: 'PUBLICATIONS' },
  { key: 'EDITORIAL_SECOND_REVIEW', label: 'Second editorial review', owner: 'PUBLICATIONS' },
  { key: 'AUTHOR_FEEDBACK_CYCLE', label: 'Author feedback cycle', owner: 'PUBLICATIONS' },
  { key: 'FINAL_CORRECTIONS_INCORPORATED', label: 'Final corrections incorporated', owner: 'PUBLICATIONS' },
  { key: 'PRINTING_REQUISITIONED', label: 'Printing requisitioned', owner: 'PUBLICATIONS' },
];

export const QUALITIES = [
  'Effectiveness',
  'Efficiency',
  'Equity',
  'Inclusiveness',
  'Responsiveness',
  'Sustainability',
  'Feasibility',
  'Coherence',
  'Accountability',
];

export const VECTOR_CATEGORIES = [
  'LAYOUT_AND_FRONT_MATTER',
  'STYLE_AND_SPELLING',
  'TABLES_AND_FIGURES',
  'CITATIONS_AND_BIBLIOGRAPHY',
  'POLICY_DRAFTING_RIGOR',
  'OUTPUT_ALIGNMENT',
];

export const PORTALS = [
  {
    role: 'RESEARCHER',
    label: 'Researcher',
    path: '/portal/researcher',
    icon: PenLine,
    blurb: 'Submit a paper, review it with Guardian, apply the suggested revisions and route it to your Head of Department.',
  },
  {
    role: 'HOD',
    label: 'Head of Department',
    path: '/portal/hod',
    icon: ClipboardCheck,
    blurb: 'Departmental in-tray, the compliance summary and the concept and draft presentation sign-offs.',
  },
  {
    role: 'DIRECTOR',
    label: 'Director',
    path: '/portal/director',
    icon: Building2,
    blurb: 'Directorate queue, strategic horizon check and clearance to the Weekly Internal Seminar.',
  },
  {
    role: 'SEMINAR_PANEL',
    label: 'WIS Panel',
    path: '/portal/seminar',
    icon: Presentation,
    blurb: 'Seminar docket, panel discussion support and the three panel decisions.',
  },
  {
    role: 'EXECUTIVE_DIRECTOR',
    label: 'Executive Director',
    path: '/portal/executive',
    icon: Stamp,
    blurb: 'Final clearance, the full lifecycle history and the authorisation for publication.',
  },
  {
    role: 'DEPUTY_DIRECTOR_KM',
    label: 'Knowledge Management',
    path: '/portal/km',
    icon: Archive,
    blurb: 'Repository intake, handle and ISBN allocation, and indexing for future reference.',
  },
  {
    role: 'PUBLICATIONS_EDITOR',
    label: 'Publications Editor',
    path: '/portal/editor',
    icon: Printer,
    blurb: 'Typesetting, author feedback, final corrections and the printing requisition.',
  },
  {
    role: 'ADMIN',
    label: 'System Admin',
    path: '/portal/admin',
    icon: Settings,
    blurb: 'Account provisioning, office and directorate assignment, and oversight of the whole suite.',
  },
  {
    role: 'SUPER_ADMIN_VAULT',
    label: 'AI Ethics Vault',
    path: '/portal/vault',
    icon: LockKeyhole,
    blurb: 'Explainability of every score, the inclusive language review and the record of all approvals.',
  },
];

export const ROLE_LABEL = PORTALS.reduce((acc, p) => ({ ...acc, [p.role]: p.label }), {});

const PREVIEW_KEY = 'styleguard.previewRole';

export const getPreviewRole = () => {
  try {
    return window.localStorage.getItem(PREVIEW_KEY) || '';
  } catch {
    return '';
  }
};

export const setPreviewRole = (role) => {
  try {
    if (role) window.localStorage.setItem(PREVIEW_KEY, role);
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Reads the KIPPRA office from a user record. Supports Supabase public.users.role
 * directly as well as kippra_role/data fields.
 */
export const roleOf = (user) => {
  const direct = user?.data?.kippra_role || user?.kippra_role || user?.role;
  if (!direct) return 'RESEARCHER';
  if (direct === 'admin') return 'ADMIN';
  if (PORTALS.some((p) => p.role === direct)) return direct;
  return 'RESEARCHER';
};

export const portalForRole = (role) =>
  PORTALS.find((p) => p.role === role) || PORTALS[0];

export const canOpenPortal = (user, role) =>
  roleOf(user) === role ||
  getPreviewRole() === role ||
  roleOf(user) === 'ADMIN' ||
  roleOf(user) === 'SUPER_ADMIN_VAULT';

export const stageIndex = (key) => STAGES.findIndex((s) => s.key === key);

export const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label || key;

export const officeTitle = (user) => {
  const office = ROLE_LABEL[roleOf(user)] || 'Researcher';
  const unit = user?.data?.department || user?.department || user?.data?.directorate || user?.directorate;
  return unit ? `${office} · ${unit}` : office;
};

export const loggedInLabel = (user) => {
  const first = firstNameOf(user);
  const rank = ROLE_LABEL[roleOf(user)] || 'Researcher';
  const dept = user?.data?.department || user?.department || user?.data?.directorate || user?.directorate;
  return dept ? `Logged in: ${first} · ${rank} (${dept})` : `Logged in: ${first} · ${rank}`;
};

export const formalSignature = (user, overrideRole) => {
  const names = twoNamesOf(user);
  const role = overrideRole || roleOf(user);
  const rank = ROLE_LABEL[role] || 'Officer';
  const unit = user?.data?.department || user?.department || user?.data?.directorate || user?.directorate;
  return unit ? `${names} — ${rank} (${unit})` : `${names} — ${rank}`;
};