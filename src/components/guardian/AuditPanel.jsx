import { useEffect, useState } from 'react';
import { Download, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { downloadAuditReport } from '@/lib/auditReport';
import ScoreRing from '@/components/guardian/ScoreRing';
import QualityRadar from '@/components/guardian/QualityRadar';
import FindingsList from '@/components/guardian/FindingsList';

const BarRow = ({ label, value }) => (
  <div>
    <div className="flex items-baseline justify-between text-[11.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground tabular">{Math.round(value || 0)}%</span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/80"
        style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}
      />
    </div>
  </div>
);

export default function AuditPanel({ auditId, manuscript, control, editable = false }) {
  const [audit, setAudit] = useState(null);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!auditId) {
      setAudit(null);
      setFindings([]);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    Promise.all([
      db.audits.get(auditId).catch(() => null),
      db.findings.filterByAudit(auditId, { limit: 120 }).catch(() => []),
    ])
      .then(([a, f]) => {
        if (!alive) return;
        setAudit(a);
        setFindings(f || []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auditId]);

  if (!auditId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-[13px] text-muted-foreground">
          Run a Guardian audit to produce the scorecard, the nine-qualities radar and the itemised findings.
        </p>
      </div>
    );
  }

  if (loading || !audit) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const locked = !audit.can_route_to_hod;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-6 border-b border-border p-5 sm:p-6">
        <ScoreRing score={audit.overall_score} caption="compliance" locked={locked} />
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider ${
                locked ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
              }`}
            >
              {locked ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {locked ? 'Gate locked' : 'Gate unlocked'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {audit.findings_total} findings · {audit.findings_critical} critical
            </span>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{audit.executive_summary}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <BarRow label="House style" value={audit.house_style_score} />
            <BarRow label="Policy rigour" value={audit.policy_rigor_score} />
            <BarRow label="Output alignment" value={audit.output_alignment_score} />
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-b border-border lg:grid-cols-2">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="eyebrow">Nine qualities of public policy</p>
          <QualityRadar qualities={audit.qualities || []} />
          <ul className="mt-2 space-y-1.5">
            {(audit.qualities || []).slice(0, 9).map((q) => (
              <li key={q.quality} className="flex gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
                <span className="w-24 shrink-0 text-foreground/80">{q.quality}</span>
                <span className="font-mono text-foreground/60 tabular">{Math.round(q.score)}</span>
                <span className="truncate">{q.rationale}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Findings</p>
            <button
              onClick={() => downloadAuditReport({ manuscript, audit, findings, control })}
              className="inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> Scorecard PDF
            </button>
          </div>
          <FindingsList
            findings={findings}
            editable={editable}
            onUpdated={(id, status) =>
              setFindings((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
            }
          />
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Citation parity</p>
          <div className="mt-2 space-y-1 text-[12px] text-muted-foreground">
            <p>
              In-text citations:{' '}
              <span className="font-mono text-foreground">{audit.citation_parity?.in_text_citations ?? 0}</span>
            </p>
            <p>
              Bibliography entries:{' '}
              <span className="font-mono text-foreground">{audit.citation_parity?.bibliography_entries ?? 0}</span>
            </p>
            <p>
              Missing from bibliography:{' '}
              <span className="font-mono text-foreground">
                {audit.citation_parity?.missing_from_bibliography?.length ?? 0}
              </span>
            </p>
            <p>
              Never cited in text:{' '}
              <span className="font-mono text-foreground">{audit.citation_parity?.uncited_in_text?.length ?? 0}</span>
            </p>
          </div>
        </div>
        <div>
          <p className="eyebrow">Agent pipeline</p>
          <ol className="mt-2 space-y-1.5">
            {(audit.agent_trace || []).map((step, i) => (
              <li key={`${step.agent}-${i}`} className="flex gap-2 text-[12px]">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    step.status === 'COMPLETED' ? 'bg-primary' : 'bg-destructive'
                  }`}
                />
                <div>
                  <p className="text-foreground">
                    {step.agent}{' '}
                    <span className="font-mono text-[10px] text-muted-foreground">{step.duration_ms}ms</span>
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">{step.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}