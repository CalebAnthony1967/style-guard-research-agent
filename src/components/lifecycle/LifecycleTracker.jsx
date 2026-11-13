import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Check, Clock, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { PHASES, SIGN_OFFS, phaseForStage, PANEL_DECISIONS } from '@/lib/lifecycle';
import { STAGES, stageIndex } from '@/lib/portals';

const fmt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function LifecycleTracker({ control, manuscript, action }) {
  const stage = control?.current_stage || manuscript?.stage || 'DRAFT_SUBMITTED';
  const current = phaseForStage(stage);
  const currentStageIdx = Math.max(0, stageIndex(stage));
  const currentStageInfo = STAGES[currentStageIdx] || STAGES[0];
  const phase = PHASES[current];
  const progress = Math.round(((currentStageIdx + 1) / STAGES.length) * 100);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!manuscript?.id) {
      setEvents([]);
      return () => { alive = false; };
    }
    db.auditLogs
      .list({ manuscriptId: manuscript.id, ascending: false, limit: 15 })
      .then((list) => {
        if (alive) setEvents(list || []);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });
    return () => { alive = false; };
  }, [manuscript?.id, stage, manuscript?.latest_audit_id]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="max-w-xl">
          <p className="eyebrow">Publication Review Pathway · Quality Standard</p>
          <h2 className="mt-1 text-lg text-foreground">{phase.title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{phase.description}</p>
          {(manuscript?.department || manuscript?.directorate) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                Origin Dept: {manuscript.department || 'Unassigned'}
              </span>
              {manuscript.directorate && (
                <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
                  {manuscript.directorate}
                </span>
              )}
              {manuscript.owner_name && (
                <span className="text-muted-foreground">Author: {manuscript.owner_name}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
            QMS Stage {currentStageIdx + 1} of {STAGES.length}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            With: {currentStageInfo.owner}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Overall workflow progress</span>
          <span className="font-mono tabular">{progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(progress, 6)}%` }} />
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((p, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li
                key={p.key}
                className={`rounded-lg border p-3 ${active ? 'border-primary/40 bg-accent/50' : done ? 'border-border bg-card' : 'border-dashed border-border bg-card/60'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                    done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <p className={`text-[12px] font-medium leading-snug ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>{p.title}</p>
                </div>
                <p className={`mt-1.5 pl-7 text-[11px] ${active ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                  {done ? `Approved (${p.owner})` : active ? `In review · ${p.owner}` : `Upcoming · ${p.owner}`}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 rounded-lg border border-border/80 bg-secondary/30 p-3.5">
          <p className="eyebrow mb-2">14-Stage approval route across KIPPRA offices</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s, idx) => {
              const passed = idx < currentStageIdx;
              const isNow = idx === currentStageIdx;
              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                    isNow
                      ? 'border-primary/50 bg-accent/60 font-medium text-foreground'
                      : passed
                        ? 'border-border bg-card text-foreground'
                        : 'border-dashed border-border/70 bg-transparent text-muted-foreground'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                      passed
                        ? 'bg-primary text-primary-foreground'
                        : isNow
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {passed ? <Check className="h-2.5 w-2.5" /> : idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={`${s.label} (${s.owner})`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Digital sign-off ledger (Name &amp; Rank)</p>
          <ul className="mt-2.5 space-y-1.5">
            {SIGN_OFFS.map((row) => {
              const signer = control?.[row.signerKey];
              const date = control?.[row.dateKey];
              return (
                <li key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-[12px] text-muted-foreground">{row.label}</span>
                  <span className="text-right text-[11.5px]">
                    {signer ? (
                      <>
                        <span className="font-medium text-foreground">{signer}</span>
                        {date && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{fmt(date)}</span>}
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">Awaiting signature</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="eyebrow">Next required action</p>
            <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-relaxed text-foreground">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {phase.next}
            </p>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Current office: {currentStageInfo.owner}</p>
            {control?.wis_panel_decision && (
              <p className="mt-2 text-[11.5px] text-foreground/80">
                Panel decision: <span className="font-medium">{PANEL_DECISIONS[control.wis_panel_decision] || control.wis_panel_decision}</span>
              </p>
            )}
            {control?.repository_handle && (
              <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Archive className="h-3.5 w-3.5" /> Repository handle {control.repository_handle}
                {control.knowledge_vectorised ? ' · indexed' : ''}
              </p>
            )}
            {action && <div className="mt-3">{action}</div>}
          </div>

          {events.length > 0 && (
            <div className="rounded-lg border border-border/80 bg-background/60 p-3.5">
              <p className="eyebrow flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Office review trail
              </p>
              <ul className="mt-2 max-h-[160px] space-y-2 overflow-y-auto pr-1">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-[11.5px]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{ev.summary || ev.action_type.replace(/_/g, ' ').toLowerCase()}</p>
                      <p className="font-mono text-[9.5px] text-muted-foreground">
                        {ev.actor_role || 'OFFICER'} · {ev.actor_email || '—'} · {fmtDateTime(ev.created_date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}