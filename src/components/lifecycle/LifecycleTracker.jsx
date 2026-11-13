import { Check, ArrowRight, Archive } from 'lucide-react';
import { PHASES, SIGN_OFFS, phaseForStage, PANEL_DECISIONS } from '@/lib/lifecycle';

const fmt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LifecycleTracker({ control, manuscript, action }) {
  const stage = control?.current_stage || manuscript?.stage || 'DRAFT_SUBMITTED';
  const current = phaseForStage(stage);
  const phase = PHASES[current];
  const progress = Math.round((current / PHASES.length) * 100);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="max-w-xl">
          <p className="eyebrow">Publication lifecycle</p>
          <h2 className="mt-1 text-lg text-foreground">{phase.title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{phase.description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
          Stage {current + 1} of {PHASES.length}
        </span>
      </div>

      <div className="p-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
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
                  {done ? 'Completed' : active ? 'In progress' : 'Upcoming'}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Sign-off record</p>
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
                        {date && <span className="ml-1.5 text-[10.5px] text-muted-foreground">{fmt(date)}</span>}
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">Awaiting</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg bg-secondary/60 p-4">
          <p className="eyebrow">Next required action</p>
          <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-relaxed text-foreground">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {phase.next}
          </p>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Owned by: {phase.owner}</p>
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
      </div>
    </section>
  );
}