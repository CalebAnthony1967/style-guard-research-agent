import { Download, FileCheck2, FileText, GitCompare } from 'lucide-react';
import { downloadTrackedDocx } from '@/lib/docxTrack';
import { downloadAuditReport } from '@/lib/auditReport';

const SAFE_RULES = ['PP062020-PRIN-03', 'KIPPRA-HS-CHECKLIST-11', 'KIPPRA-HS-BIAS-02', 'KIPPRA-HS-CHECKLIST-38'];

const sourceLabel = (identifier = '') => {
  if (identifier.includes('CHECKLIST')) return `House Style · item ${identifier.split('-').pop()}`;
  if (identifier.startsWith('PP062020')) return 'PP/06/2020';
  if (identifier.startsWith('BIAS')) return 'Inclusive language';
  return 'Standards';
};

export default function DiffViewer({ manuscript, findings = [], audit, control }) {
  const changes = [];
  const seen = new Set();
  findings.forEach((f) => {
    if (!SAFE_RULES.includes(f.rule_identifier)) return;
    if (!f.original_text_excerpt || !f.suggested_correction) return;
    const key = `${f.original_text_excerpt}|${f.suggested_correction}`;
    if (seen.has(key)) return;
    seen.add(key);
    changes.push({ from: f.original_text_excerpt, to: f.suggested_correction, rule: f.rule_identifier });
  });

  const revisionBody = manuscript?.revision_text || manuscript?.manuscript_text || '';

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><GitCompare className="h-3.5 w-3.5" /> Editorial co-pilot</p>
          <h2 className="mt-1 text-lg text-foreground">Suggested Revisions (Track Changes)</h2>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {changes.length} suggested {changes.length === 1 ? 'revision' : 'revisions'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <div className="bg-card px-4 py-2">Submitted text</div>
        <div className="bg-card px-4 py-2">Suggested revision</div>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {changes.length === 0 && (
          <p className="p-5 text-[12.5px] leading-relaxed text-muted-foreground">
            No automatic revisions are staged for this paper. Review the suggested corrections above, or run a new
            review after editing.
          </p>
        )}
        {changes.map((c) => (
          <div key={`${c.rule}-${c.from}`} className="grid grid-cols-2 gap-px border-b border-border/60 bg-border last:border-0">
            <div className="bg-card px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{sourceLabel(c.rule)}</p>
              <p className="mt-1 text-[12.5px] text-destructive line-through decoration-destructive/40">{c.from}</p>
            </div>
            <div className="bg-card px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-primary">Suggested</p>
              <p className="mt-1 text-[12.5px] text-foreground">{c.to}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 p-4">
        <button
          onClick={() => downloadTrackedDocx({ title: manuscript?.title, body: revisionBody, changes })}
          disabled={!revisionBody}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11.5px] font-medium text-primary-foreground disabled:opacity-40"
        >
          <FileCheck2 className="h-3.5 w-3.5" /> Download Paper with Track Changes
        </button>
        <button
          onClick={() => downloadTrackedDocx({ title: manuscript?.title, body: revisionBody, changes: [], includeRevisions: false })}
          disabled={!revisionBody}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11.5px] font-medium text-foreground disabled:opacity-40"
        >
          <FileText className="h-3.5 w-3.5" /> Clean camera-ready
        </button>
        <button
          onClick={() => downloadAuditReport({ manuscript, audit, findings, control })}
          disabled={!audit}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11.5px] text-muted-foreground disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Scorecard PDF
        </button>
      </div>
    </section>
  );
}