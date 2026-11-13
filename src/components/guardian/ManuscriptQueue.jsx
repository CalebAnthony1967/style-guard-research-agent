import { ChevronRight } from 'lucide-react';
import { stageLabel, STAGES, stageIndex } from '@/lib/portals';

const STATUS_TONE = {
  AWAITING_SIGNOFF: 'bg-accent text-accent-foreground',
  RETURNED: 'bg-destructive/10 text-destructive',
  APPROVED: 'bg-primary/10 text-primary',
  PUBLISHED: 'bg-primary/10 text-primary',
  DRAFT: 'bg-secondary text-muted-foreground',
  IN_AUDIT: 'bg-accent text-accent-foreground',
};

export default function ManuscriptQueue({ items = [], selectedId, onSelect, emptyText = 'Nothing in this tray.' }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-[13px] text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((m) => {
        const active = m.id === selectedId;
        const idx = stageIndex(m.stage);
        return (
          <li key={m.id}>
            <button
              onClick={() => onSelect(m.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                active ? 'border-primary/40 bg-accent/40' : 'border-border bg-card hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-foreground">{m.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="rounded-full bg-brand-burgundy/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand-burgundy">
                      {m.paper_type}
                    </span>
                    {m.owner_name || m.owner_email || 'author'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl leading-none text-foreground tabular">
                    {m.latest_score != null ? `${Math.round(m.latest_score)}%` : '—'}
                  </p>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-wider ${STATUS_TONE[m.status] || STATUS_TONE.DRAFT}`}>
                    {(m.status || 'DRAFT').replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 gap-0.5">
                  {STAGES.map((s, i) => (
                    <span
                      key={s.key}
                      className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-primary/70' : 'bg-muted'}`}
                      title={s.label}
                    />
                  ))}
                </div>
                <span className="flex items-center gap-0.5 text-[10.5px] text-muted-foreground">
                  {stageLabel(m.stage)} <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}