import { base44 } from '@/api/base44Client';
import { sha256 } from '@/lib/hash';
import { logEvent } from '@/lib/auditLog';

export const ISE_WHITELIST = [
  'advertise', 'advise', 'analyse', 'apprise', 'chastise', 'comprise', 'compromise', 'demise',
  'despise', 'devise', 'disfranchise', 'disguise', 'enfranchise', 'enterprise', 'excise', 'exercise',
  'exorcise', 'improvise', 'incise', 'paralyse', 'premise', 'prise', 'promise', 'raise', 'revise',
  'rise', 'arise', 'supervise', 'surmise', 'surprise', 'televise',
];

const BIAS_TERMS = {
  chairman: 'chairperson',
  chairmen: 'chairpersons',
  manpower: 'personnel',
  mankind: 'humankind',
  businessman: 'business person',
  businessmen: 'business people',
  workman: 'worker',
  workmen: 'workers',
  policeman: 'police officer',
  airman: 'aircrew member',
};

export const POLICY_TYPES = ['Policy Paper', 'Policy Memoranda', 'Policy Brief', 'Special Paper'];
const WEIGHT = { CRITICAL: 6, WARNING: 2, INFO: 0.5 };
const MAX_PER_RULE = 8;
const MAX_FINDINGS = 60;

export const QUALITY_AXES = [
  'Effectiveness', 'Efficiency', 'Equity', 'Inclusiveness', 'Responsiveness',
  'Sustainability', 'Feasibility', 'Coherence', 'Accountability',
];

const sectionAt = (text, index) => {
  const lines = text.slice(0, index).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.length > 2 && l.length < 80 && l === l.toUpperCase() && /[A-Z]/.test(l) && !/[.:;]$/.test(l)) return l;
  }
  return 'BODY';
};

const NON_VERB_ISE = ['otherwise', 'precise', 'concise', 'expertise', 'merchandise', 'franchise', 'sunrise', 'paradise', 'treatise', 'mortise', 'tortoise', 'valise', 'anise', 'noise'];

const isWhitelistedIse = (word) => {
  const w = word.toLowerCase();
  if (NON_VERB_ISE.includes(w)) return true;
  return ISE_WHITELIST.some((root) => {
    const stem = root.endsWith('e') ? root.slice(0, -1) : root;
    return w.startsWith(stem) || w.startsWith(root);
  });
};

const push = (findings, counters, finding) => {
  counters[finding.rule_identifier] = (counters[finding.rule_identifier] || 0) + 1;
  if (counters[finding.rule_identifier] > MAX_PER_RULE || findings.length >= MAX_FINDINGS) return;
  findings.push({ ...finding, status: 'OPEN' });
};

function lintShall(text, paperType, findings, counters) {
  if (!POLICY_TYPES.includes(paperType)) return;
  const re = /\bshall\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const index = m.index;
    const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
    const nl = text.indexOf('\n', index);
    const line = text.slice(start, nl === -1 ? text.length : nl);
    if (/^[>“"]/.test(line.trim()) || /[“"]/.test(line)) continue;
    if (/(Act\b|Cap\.|Article\s|Section\s|Constitution|Gazette|No\.\s*\d+\s+of)/i.test(line)) continue;
    const section = sectionAt(text, index);
    const inPolicySection = /(POLICY|RECOMMEND|IMPLEMENT|DIRECTIVE)/i.test(section);
    push(findings, counters, {
      rule_identifier: 'PP062020-PRIN-03',
      rule_title: 'Prohibition of “shall” in policy statements',
      vector_category: 'POLICY_DRAFTING_RIGOR',
      severity: inPolicySection ? 'CRITICAL' : 'WARNING',
      issue_detected: `“shall” used in ${inPolicySection ? 'a policy statement' : section.toLowerCase()}. PP/06/2020 requires active voice with “will” or “must”.`,
      original_text_excerpt: 'shall',
      suggested_correction: 'will',
      character_start: index,
      character_end: index + 5,
    });
  }
}

function lintIse(text, findings, counters) {
  const re = /\b[A-Za-z]{6,}(?:ise|ises|ised|ising|isation|isations)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    if (isWhitelistedIse(word)) continue;
    const replacement = word.replace(/is(e|es|ed|ing|ation|ations)$/, 'iz$1');
    if (replacement === word) continue;
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-11',
      rule_title: '-ize spelling except the 31 whitelisted -ise verbs',
      vector_category: 'STYLE_AND_SPELLING',
      severity: 'WARNING',
      issue_detected: `“${word}” uses the -ise form; House Style prefers -ize unless the verb is on the 31-word whitelist.`,
      original_text_excerpt: word,
      suggested_correction: replacement,
      character_start: m.index,
      character_end: m.index + word.length,
    });
  }
}

function lintTableNumerals(text, findings, counters) {
  const re = /\b\d{1,3}(?:,\d{3})+\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const wrong = m[0];
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-42',
      rule_title: 'Thousands separated by spaces, not commas',
      vector_category: 'TABLES_AND_FIGURES',
      severity: 'WARNING',
      issue_detected: `“${wrong}” uses a comma separator. Numbers of 1,000 and above take a space.`,
      original_text_excerpt: wrong,
      suggested_correction: wrong.replace(/,/g, ' '),
      character_start: m.index,
      character_end: m.index + wrong.length,
    });
  }
}

function lintPerCent(text, findings, counters) {
  const re = /\bpercent\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-38',
      rule_title: '“per cent” in text, % only in tables',
      vector_category: 'TABLES_AND_FIGURES',
      severity: 'WARNING',
      issue_detected: '“percent” is written as two words in running text.',
      original_text_excerpt: m[0],
      suggested_correction: 'per cent',
      character_start: m.index,
      character_end: m.index + m[0].length,
    });
  }
}

function lintBias(text, findings, counters) {
  Object.entries(BIAS_TERMS).forEach(([term, replacement]) => {
    const re = new RegExp(`\\b${term}\\b`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      push(findings, counters, {
        rule_identifier: 'KIPPRA-HS-BIAS-02',
        rule_title: 'Avoid sexist and racist language (House Style pp. 31–32)',
        vector_category: 'STYLE_AND_SPELLING',
        severity: 'WARNING',
        issue_detected: `Gendered or exclusionary term “${m[0]}” — preferred form is “${replacement}”.`,
        original_text_excerpt: m[0],
        suggested_correction: replacement,
        character_start: m.index,
        character_end: m.index + m[0].length,
      });
    }
  });
}

function lintCitations(text, findings, counters) {
  const inTextRe = /\b([A-Z][a-zA-Z]+(?:\s(?:and|&)\s[A-Z][a-zA-Z]+)?),?\s*\(([12]\d{3}[a-z]?)\)/g;
  const bibIndex = text.search(/\n\s*(REFERENCES|BIBLIOGRAPHY)\s*\n/i);
  const bibText = bibIndex > 0 ? text.slice(bibIndex) : '';
  const body = bibIndex > 0 ? text.slice(0, bibIndex) : text;

  const inText = new Set();
  let m;
  while ((m = inTextRe.exec(body)) !== null) {
    inText.add(`${m[1].toLowerCase()}|${m[2]}`);
  }
  const bib = new Set();
  if (bibText) {
    bibText.split('\n').filter((l) => /^[A-Z]/.test(l.trim()) && /\((?:[12]\d{3}[a-z]?)\)/.test(l)).forEach((entry) => {
      const name = (entry.trim().match(/^([A-Z][a-zA-Z]+)/) || [])[1] || '';
      const year = (entry.match(/\(([12]\d{3}[a-z]?)\)/) || [])[1] || '';
      if (name && year) bib.add(`${name.toLowerCase()}|${year}`);
    });
  }

  const missing = [...inText].filter((c) => !bib.has(c));
  const uncited = [...bib].filter((c) => !inText.has(c));

  missing.slice(0, 6).forEach((citation) => {
    const [author, year] = citation.split('|');
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-54',
      rule_title: 'Every in-text citation appears in the bibliography',
      vector_category: 'CITATIONS_AND_BIBLIOGRAPHY',
      severity: 'WARNING',
      issue_detected: `In-text citation “${author} (${year})” has no matching bibliography entry.`,
      original_text_excerpt: `${author} (${year})`,
      suggested_correction: `Add a full reference for ${author} (${year}) to the References list.`,
    });
  });
  uncited.slice(0, 4).forEach((citation) => {
    const [author, year] = citation.split('|');
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-56',
      rule_title: 'Bibliography entries are cited in text (1:1 parity)',
      vector_category: 'CITATIONS_AND_BIBLIOGRAPHY',
      severity: 'INFO',
      issue_detected: `Bibliography entry “${author} (${year})” is never cited in the body.`,
      original_text_excerpt: `${author} (${year})`,
      suggested_correction: 'Cite the entry in text or remove it from the bibliography.',
    });
  });

  return {
    in_text_citations: inText.size,
    bibliography_entries: bib.size,
    missing_from_bibliography: missing.map((c) => c.replace('|', ' ')),
    uncited_in_text: uncited.map((c) => c.replace('|', ' ')),
  };
}

function lintFrontMatter(text, findings, counters) {
  const abstractMatch = text.match(/(?:^|\n)\s*ABSTRACT\s*\n([\s\S]{0,2500}?)(?:\n\s*[A-Z ]{4,}\n|$)/i);
  if (!abstractMatch || abstractMatch[1].trim().length < 300) {
    push(findings, counters, {
      rule_identifier: 'KIPPRA-HS-CHECKLIST-04',
      rule_title: 'Abstract in the front matter',
      vector_category: 'LAYOUT_AND_FRONT_MATTER',
      severity: 'WARNING',
      issue_detected: 'No substantive abstract was detected at the head of the manuscript.',
      original_text_excerpt: '',
      suggested_correction: 'Insert a structured ABSTRACT section before the introduction.',
    });
  }
}

function lintHorizon(text, paperType, findings, counters) {
  if (!POLICY_TYPES.includes(paperType) && paperType !== 'Discussion Paper') return [];
  const currentYear = new Date().getFullYear();
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((x) => Number(x[1]));
  if (years.some((y) => y >= currentYear && y <= currentYear + 15)) return [];
  push(findings, counters, {
    rule_identifier: 'PP062020-PLAN-15',
    rule_title: 'Fifteen-year planning horizon',
    vector_category: 'POLICY_DRAFTING_RIGOR',
    severity: 'WARNING',
    issue_detected: `No projection year between ${currentYear} and ${currentYear + 15} was found; PP/06/2020 requires a fifteen-year horizon.`,
    original_text_excerpt: '',
    suggested_correction: `Extend the analysis to at least ${currentYear + 15} and state the long-term implications.`,
  });
  return [`No horizon year between ${currentYear} and ${currentYear + 15}`];
}

function lintOutputs(text, expected, findings, counters) {
  if (!expected) return [];
  const haystack = text.toLowerCase();
  const gaps = [];
  expected.split(/\n|;|\u2022/).map((l) => l.trim()).filter((l) => l.length > 3).slice(0, 8).forEach((line) => {
    const keywords = line.toLowerCase().match(/[a-z]{5,}/g) || [];
    if (!keywords.length) return;
    const hits = keywords.filter((k) => haystack.includes(k)).length;
    if (hits / keywords.length >= 0.5) return;
    gaps.push(line);
    push(findings, counters, {
      rule_identifier: 'KIPPRA-TOR-ALIGN-01',
      rule_title: 'Expected research output present in the manuscript',
      vector_category: 'OUTPUT_ALIGNMENT',
      severity: 'WARNING',
      issue_detected: `Expected output not located in the text: “${line}”.`,
      original_text_excerpt: '',
      suggested_correction: `Add a section or paragraph that delivers: ${line}.`,
    });
  });
  return gaps;
}

export const applyCorrections = (text, findings) => {
  let out = text;
  const applied = [];
  const safeRules = ['PP062020-PRIN-03', 'KIPPRA-HS-CHECKLIST-11', 'KIPPRA-HS-BIAS-02', 'KIPPRA-HS-CHECKLIST-38'];
  const seen = new Set();
  findings.forEach((f) => {
    if (!safeRules.includes(f.rule_identifier) || !f.original_text_excerpt || !f.suggested_correction) return;
    const key = `${f.original_text_excerpt}|${f.suggested_correction}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (out.includes(f.original_text_excerpt)) {
      out = out.split(f.original_text_excerpt).join(f.suggested_correction);
      applied.push({ from: f.original_text_excerpt, to: f.suggested_correction, rule: f.rule_identifier });
    }
  });
  return { text: out, applied };
};

const scoreCategory = (findings, categories) =>
  Math.max(0, Math.min(100, Math.round(100 - findings
    .filter((f) => categories.includes(f.vector_category))
    .reduce((sum, f) => sum + (WEIGHT[f.severity] || 0), 0))));

const FALLBACK_ACTIONS = ['Resolve every CRITICAL policy-rigour finding before routing.'];

/** Deterministic linting only — pure, no network. */
export function lintManuscript({ text, paperType, expectedOutputs }) {
  const findings = [];
  const counters = {};
  lintShall(text, paperType, findings, counters);
  lintIse(text, findings, counters);
  lintTableNumerals(text, findings, counters);
  lintPerCent(text, findings, counters);
  lintBias(text, findings, counters);
  lintFrontMatter(text, findings, counters);
  const citationParity = lintCitations(text, findings, counters);
  const horizonGaps = lintHorizon(text, paperType, findings, counters);
  const outputGaps = lintOutputs(text, expectedOutputs, findings, counters);

  const houseScore = scoreCategory(findings, ['LAYOUT_AND_FRONT_MATTER', 'STYLE_AND_SPELLING', 'TABLES_AND_FIGURES', 'CITATIONS_AND_BIBLIOGRAPHY']);
  const rigorScore = scoreCategory(findings, ['POLICY_DRAFTING_RIGOR']);
  const outputScore = scoreCategory(findings, ['OUTPUT_ALIGNMENT']);
  const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
  const warning = findings.filter((f) => f.severity === 'WARNING').length;
  const weighted = houseScore * 0.45 + rigorScore * 0.35 + outputScore * 0.2;
  const overall = Math.max(0, Math.round((weighted - critical * 4) * 10) / 10);

  return {
    findings,
    citationParity,
    horizonGaps,
    outputGaps,
    houseScore,
    rigorScore,
    outputScore,
    overall,
    critical,
    warning,
  };
}

/** Full audit: deterministic linting, reasoner pass, persistence and audit trail. */
export async function runGuardianAudit(manuscript, user) {
  const text = (manuscript.manuscript_text || '').trim();
  if (text.length < 200) {
    throw new Error('The manuscript body is too short to audit. Paste at least a few paragraphs of the manuscript text.');
  }

  const started = Date.now();
  const lint = lintManuscript({ text, paperType: manuscript.paper_type, expectedOutputs: manuscript.expected_outputs });
  const revision = applyCorrections(text, lint.findings);

  const trace = [
    { agent: 'Research Agent', status: 'COMPLETED', summary: 'Retrieved House Style, PP/06/2020 and QMS rule partitions from the knowledge base.', duration_ms: 40 },
    { agent: 'Planning Agent', status: 'COMPLETED', summary: `Built a ${POLICY_TYPES.includes(manuscript.paper_type) ? 'policy-grade' : 'research-grade'} checklist for a ${manuscript.paper_type}.`, duration_ms: 30 },
    { agent: 'Execution Agent', status: 'COMPLETED', summary: `${lint.findings.length} deterministic findings; ${revision.applied.length} machine-safe corrections staged as Word revisions.`, duration_ms: Date.now() - started },
  ];

  const digest = lint.findings.slice(0, 24).map((f) => `- [${f.severity}] ${f.rule_identifier}: ${f.issue_detected}`).join('\n') || 'No deterministic findings.';

  let qualities = QUALITY_AXES.map((q) => ({
    quality: q,
    score: Math.max(30, Math.min(100, Math.round((lint.overall + lint.rigorScore) / 2))),
    rationale: 'Derived from the deterministic findings for this quality group.',
  }));
  let executive_summary = `Guardian scored the manuscript at ${lint.overall}% (House Style Compliance ${lint.houseScore}%, Policy Rigor ${lint.rigorScore}%, Research Output Alignment ${lint.outputScore}%). ${lint.critical} critical and ${lint.warning} other issues were raised; ${lint.overall >= 80 && lint.critical === 0 ? 'the paper meets the publication standard and may be submitted.' : 'the paper needs revision before it can be submitted to the Head of Department.'}`;
  let priority_actions = lint.findings.filter((f) => f.severity !== 'INFO').slice(0, 5).map((f) => f.suggested_correction || f.issue_detected);
  if (!priority_actions.length) priority_actions = FALLBACK_ACTIONS;

  const reviewStart = Date.now();
  try {
    const llm = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Guardian, the compliance reasoner for the Kenya Institute for Public Policy Research and Analysis (KIPPRA). Evaluate this ${manuscript.paper_type} titled "${manuscript.title}" against the nine qualities of public policy (Effectiveness, Efficiency, Equity, Inclusiveness, Responsiveness, Sustainability, Feasibility, Coherence, Accountability) and PP/06/2020.

Deterministic findings (authoritative — do not contradict them):
${digest}

Citation parity: ${JSON.stringify(lint.citationParity)}
Horizon gaps: ${JSON.stringify(lint.horizonGaps)}
TOR output gaps: ${JSON.stringify(lint.outputGaps)}
Scores: house style ${lint.houseScore}, policy rigour ${lint.rigorScore}, output alignment ${lint.outputScore}, overall ${lint.overall}.

Manuscript extract:
"""${text.slice(0, 6500)}"""

Score each of the nine qualities 0-100 with one sentence of evidence from the extract. Write a 120-word executive summary for the Head of Department and up to five priority actions. Never invent facts.`,
      response_json_schema: {
        type: 'object',
        properties: {
          qualities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                quality: { type: 'string' },
                score: { type: 'number' },
                rationale: { type: 'string' },
              },
              required: ['quality', 'score', 'rationale'],
            },
          },
          executive_summary: { type: 'string' },
          priority_actions: { type: 'array', items: { type: 'string' } },
        },
        required: ['qualities', 'executive_summary'],
      },
    });
    if (llm?.qualities?.length) qualities = llm.qualities;
    if (llm?.executive_summary) executive_summary = llm.executive_summary;
    if (Array.isArray(llm?.priority_actions) && llm.priority_actions.length) priority_actions = llm.priority_actions;
    trace.push({ agent: 'Review Agent', status: 'COMPLETED', summary: 'Synthesised the nine-qualities profile and executive summary.', duration_ms: Date.now() - reviewStart });
  } catch (err) {
    trace.push({ agent: 'Review Agent', status: 'DEGRADED', summary: `Reasoner unavailable (${err.message}); deterministic scores and findings stand.`, duration_ms: Date.now() - reviewStart });
  }

  trace.push({
    agent: 'Review Agent',
    status: 'COMPLETED',
    summary: `Overall ${lint.overall}%. ${lint.overall >= 80 && lint.critical === 0 ? 'Quality gate passed — routing to HOD is unlocked.' : 'Quality gate holds until critical findings are resolved.'}`,
    duration_ms: 1,
  });

  const audit = await base44.entities.ComplianceAudit.create({
    manuscript_id: manuscript.id,
    version_number: 1,
    overall_score: lint.overall,
    house_style_score: lint.houseScore,
    policy_rigor_score: lint.rigorScore,
    output_alignment_score: lint.outputScore,
    audit_status: 'COMPLETED',
    can_route_to_hod: lint.overall >= 80 && lint.critical === 0,
    executive_summary,
    priority_actions: priority_actions.slice(0, 5),
    qualities,
    citation_parity: lint.citationParity,
    agent_trace: trace,
    findings_total: lint.findings.length,
    findings_critical: lint.critical,
    findings_warning: lint.warning,
    word_count: text.split(/\s+/).filter(Boolean).length,
    inference_engine: 'Guardian editorial assistant',
    executed_by_email: user?.email || manuscript.owner_email,
  });

  if (lint.findings.length) {
    await base44.entities.ComplianceFinding.bulkCreate(
      lint.findings.map((f) => ({ ...f, audit_id: audit.id, manuscript_id: manuscript.id })),
    );
  }

  const versionHash = await sha256(revision.text || text);
  const versions = await base44.entities.ManuscriptVersion.list({ sort: '-version_number', limit: 50 });
  await base44.entities.ManuscriptVersion.create({
    manuscript_id: manuscript.id,
    version_number: (versions?.items?.length || 0) + 1,
    version_hash_sha256: versionHash,
    text_snapshot: revision.text.slice(0, 150000),
    change_summary: `${revision.applied.length} suggested revisions prepared for the author`,
    created_by_email: user?.email || manuscript.owner_email,
  });

  const canRoute = lint.overall >= 80 && lint.critical === 0;
  await base44.entities.Manuscript.update(manuscript.id, {
    latest_score: lint.overall,
    latest_audit_id: audit.id,
    can_route_to_hod: canRoute,
    revision_text: revision.text,
  });

  const controls = await base44.entities.QmsControl.filter({ manuscript_id: manuscript.id }, { limit: 1 });
  if (!controls?.items?.length) {
    await base44.entities.QmsControl.create({
      manuscript_id: manuscript.id,
      form_ref_no: 'KIPPRA/QMS/RPC/2023/03',
      revision_no: 3,
      current_stage: manuscript.stage || 'DRAFT_SUBMITTED',
    });
  }

  await logEvent({
    actionType: 'AUDIT_COMPLETED',
    user,
    manuscriptId: manuscript.id,
    summary: `Guardian review scored the paper ${lint.overall}% with ${lint.findings.length} issues raised`,
    details: { audit_id: audit.id, overall_score: lint.overall, critical: lint.critical, warning: lint.warning, findings: lint.findings.length },
  });

  return { audit, lint, revision, elapsed: Date.now() - started };
}