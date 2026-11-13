import { jsPDF } from 'jspdf';

const sourceLabel = (identifier = '') => {
  if (identifier.includes('CHECKLIST')) return `House Style Manual, item ${identifier.split('-').pop()}`;
  if (identifier.startsWith('PP062020')) return 'PP/06/2020, policy drafting';
  if (identifier.startsWith('BIAS')) return 'House Style Manual, inclusive language';
  if (identifier.startsWith('TOR')) return 'Terms of reference';
  return 'KIPPRA publication standards';
};

const severityLabel = (severity = '') =>
  severity === 'CRITICAL' ? 'Critical' : severity === 'WARNING' ? 'Warning' : 'Note';

const PAGE_W = 210;
const MARGIN = 16;

export function buildAuditReport({ manuscript, audit, findings = [], control }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 22;

  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.text('KIPPRA StyleGuard — Manuscript Compliance Report', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('KIPPRA Research & Publications Control Form · Revision 3', MARGIN, y);
  doc.setTextColor(0);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text(manuscript?.title || 'Manuscript', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const meta = [
    `Series: ${manuscript?.paper_type || '—'}`,
    `Author: ${manuscript?.owner_name || '—'} (${manuscript?.owner_email || '—'})`,
    `Department: ${manuscript?.department || '—'}`,
    `Review reference: ${audit?.id || '—'}`,
    `Reviewed: ${audit?.created_date ? new Date(audit.created_date).toLocaleString() : '—'}`,
    `Word count: ${audit?.word_count || '—'}`,
    'Reviewed by: Guardian editorial assistant',
  ];
  meta.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 4.6;
  });

  y += 3;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Scores', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const rows = [
    ['Overall compliance', `${audit?.overall_score ?? '—'}%`],
    ['House Style Compliance', `${audit?.house_style_score ?? '—'}%`],
    ['Policy Rigor (PP/06/2020)', `${audit?.policy_rigor_score ?? '—'}%`],
    ['Research Output Alignment', `${audit?.output_alignment_score ?? '—'}%`],
    ['Publication readiness', audit?.can_route_to_hod ? 'Ready to submit' : 'Revisions required'],
    ['Issues raised', `${audit?.findings_total ?? 0} total · ${audit?.findings_critical ?? 0} critical · ${audit?.findings_warning ?? 0} other`],
  ];
  rows.forEach(([label, value]) => {
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), MARGIN + 92, y);
    doc.setFont('helvetica', 'normal');
    y += 5.4;
  });

  y += 3;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Executive summary', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const summary = doc.splitTextToSize(audit?.executive_summary || 'No summary recorded.', PAGE_W - MARGIN * 2);
  doc.text(summary, MARGIN, y);
  y += summary.length * 4.3 + 5;

  if (findings.length) {
    if (y > 240) { doc.addPage(); y = 22; }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Priority corrections', MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    findings.slice(0, 14).forEach((f, i) => {
      if (y > 262) { doc.addPage(); y = 22; }
      const text = `${i + 1}. [${severityLabel(f.severity)}] ${sourceLabel(f.rule_identifier)} — ${f.issue_detected}`;
      const lines = doc.splitTextToSize(text, PAGE_W - MARGIN * 2);
      doc.text(lines, MARGIN, y);
      y += lines.length * 3.9 + 1.6;
    });
  }

  if (y > 215) { doc.addPage(); y = 22; }
  y += 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Nine qualities of public policy', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  (audit?.qualities || []).forEach((q) => {
    if (y > 272) { doc.addPage(); y = 22; }
    doc.text(`${q.quality}`, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${q.score}`, MARGIN + 62, y);
    doc.setFont('helvetica', 'normal');
    const rationale = doc.splitTextToSize(q.rationale || '', 108);
    doc.text(rationale, MARGIN + 72, y);
    y += Math.max(rationale.length * 3.7, 4.4);
  });

  if (y > 235) { doc.addPage(); y = 22; }
  y += 8;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Lifecycle sign-offs', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const signoffs = [
    ['Concept presented to department', control?.concept_hod_signer, control?.concept_presentation_date],
    ['Draft presented to department', control?.draft_hod_signer, control?.draft_presentation_date],
    ['Directorate review completed', control?.director_signer, control?.director_review_completed_date],
    ['Cleared to the Weekly Internal Seminar', control?.director_signer, control?.cleared_to_wis_date],
    ['Seminar panel decision', control?.wis_rapporteur, control?.wis_panel_decision],
    ['Authorised for publication', control?.ed_signer, control?.ed_authorization_date],
    ['Received by Knowledge Management', control?.km_signer, control?.km_receipt_date],
    ['Printing requisitioned', 'Publications Editor', control?.printing_requisition_date],
  ];
  signoffs.forEach(([label, who, when]) => {
    doc.text(`${label}: ${who || 'not signed'} ${when ? `· ${when}` : ''}`, MARGIN, y);
    y += 4.6;
  });

  y += 6;
  doc.setFontSize(7.6);
  doc.setTextColor(120);
  const note = doc.splitTextToSize('Generated by Guardian. Deterministic rule codes and evidence excerpts support every deduction. This scorecard is an advisory artifact for the Head of Department; publication authority rests with the human signatories of KIPPRA/QMS/RPC/2023/03.', PAGE_W - MARGIN * 2);
  doc.text(note, MARGIN, y);

  return doc;
}

export function downloadAuditReport(opts) {
  const doc = buildAuditReport(opts);
  const safe = (opts.manuscript?.title || 'manuscript').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  doc.save(`${safe}-guardian-scorecard.pdf`);
}