/**
 * Canonical KIPPRA Research Organisational Structure
 * Derived from the Institute Organogram concentrating on the two Research Directorates
 * (Economic Management & Integrated Development) and institutional oversight stations.
 */

export const RESEARCH_DIRECTORATES = [
  {
    name: 'Directorate of Economic Management',
    short: 'Economic Management',
    departments: [
      'Macroeconomics Department',
      'Social Sector Department',
      'Governance Department',
      'Capacity Building Department',
      'Partnerships Department',
    ],
  },
  {
    name: 'Directorate of Integrated Development',
    short: 'Integrated Development',
    departments: [
      'Productive Sector Department',
      'Infrastructure & Economic Services Department',
      'Trade & Foreign Policy Department',
      'Private Sector Development Department',
      'Knowledge Management Department',
    ],
  },
];

export const INSTITUTIONAL_UNITS = [
  {
    name: 'Executive Office',
    short: 'Executive Office',
    departments: ['Office of the Executive Director', 'Weekly Internal Seminar Secretariat'],
  },
  {
    name: 'Publications & Institutional Services',
    short: 'Publications & ICT',
    departments: [
      'Publications & Editorial Unit',
      'Information and Communication Technology',
      'Internal Audit & AI Ethics Governance',
    ],
  },
];

export const ALL_DIRECTORATES = [...RESEARCH_DIRECTORATES, ...INSTITUTIONAL_UNITS];

export const ALL_RESEARCH_DEPARTMENTS = RESEARCH_DIRECTORATES.flatMap((d) => d.departments);

export const ALL_DEPARTMENTS = ALL_DIRECTORATES.flatMap((d) => d.departments);

export function departmentsForDirectorate(directorateName = '') {
  const needle = String(directorateName || '').trim().toLowerCase();
  if (!needle) return ALL_RESEARCH_DEPARTMENTS;
  const match = ALL_DIRECTORATES.find(
    (d) =>
      d.name.toLowerCase() === needle ||
      d.short.toLowerCase() === needle ||
      needle.includes(d.short.toLowerCase()),
  );
  return match ? match.departments : ALL_RESEARCH_DEPARTMENTS;
}

export function directorateForDepartment(departmentName = '') {
  const needle = String(departmentName || '').trim().toLowerCase();
  if (!needle) return '';
  for (const dir of ALL_DIRECTORATES) {
    if (
      dir.departments.some(
        (dept) =>
          dept.toLowerCase() === needle ||
          dept.toLowerCase().replace(/\s+department$/i, '') === needle.replace(/\s+department$/i, ''),
      )
    ) {
      return dir.name;
    }
  }
  return '';
}

export function canonicalDepartmentName(departmentName = '') {
  const needle = String(departmentName || '').trim().toLowerCase();
  if (!needle) return '';
  for (const dept of ALL_DEPARTMENTS) {
    if (
      dept.toLowerCase() === needle ||
      dept.toLowerCase().replace(/\s+department$/i, '') === needle.replace(/\s+department$/i, '')
    ) {
      return dept;
    }
  }
  return String(departmentName || '').trim();
}

const HONORIFICS = new Set(['dr', 'dr.', 'prof', 'prof.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'hon', 'hon.']);

const titleWord = (w = '') => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '');

/**
 * Extracts the officer's clear First Name for signed-in status labels.
 */
export function firstNameOf(user) {
  const rawName = String(user?.full_name || user?.name || '').trim();
  if (rawName) {
    const tokens = rawName.split(/\s+/).filter(Boolean);
    const nonHonorific = tokens.filter((t) => !HONORIFICS.has(t.toLowerCase()));
    if (nonHonorific.length > 0) return titleWord(nonHonorific[0]);
    return titleWord(tokens[0]);
  }
  const emailPrefix = String(user?.email || '').split('@')[0] || '';
  const emailParts = emailPrefix.split(/[._-]+/).filter(Boolean);
  return titleWord(emailParts[0] || 'Officer');
}

/**
 * Extracts Two+ Names for formal approvals and QMS digital signatures.
 */
export function twoNamesOf(user) {
  const rawName = String(user?.full_name || user?.name || '').trim();
  if (rawName) {
    const tokens = rawName.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      return tokens.map((t) => (HONORIFICS.has(t.toLowerCase()) ? titleWord(t) : titleWord(t))).join(' ');
    }
  }
  const emailPrefix = String(user?.email || '').split('@')[0] || '';
  const emailParts = emailPrefix.split(/[._-]+/).filter(Boolean);
  if (emailParts.length >= 2) {
    return `${titleWord(emailParts[0])} ${titleWord(emailParts[1])}`;
  }
  return rawName ? `${titleWord(rawName)} (KIPPRA Officer)` : 'KIPPRA Officer';
}
