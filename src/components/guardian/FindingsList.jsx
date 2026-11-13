import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { db } from '@/lib/db';

const SEVERITY_BADGE = {
  CRITICAL: 'border-destructive/40 bg-destructive/10 text-destructive',
  WARNING: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  INFO: 'border-border bg-secondary text-muted-foreground',
};

const VECTOR_LABEL = {
  LAYOUT_AND_FRONT_MATTER: 'Layout & front matter',
  STYLE_AND_SPELLING: 'Style & spelling',
  TABLES_AND_FIGURES: 'Tables & figures',
  CITATIONS_AND_BIBLIOGRAPHY: 'Citations & bibliography',
  POLICY_DRAFTING_RIGOR: 'Policy rigour',
  OUTPUT_ALIGNMENT: 'Output alignment',
};

const FILTERS = ['ALL', 'CRITICAL', 'WARNING', 'INFO'];

export default function FindingsList({ findings = [], editable = false, onUpdated }) {
  const [filter, setFilter] = useState('ALL');
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const visible = findings.filter((f) => filter === 'ALL' || f.severity === filter);

  const setStatus = async (finding, status) => {
    setBusyId(finding.id);
    try {
      await db.findings.update(finding.id, { status });
      onUpdated?.(finding.id, status);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((key) => {
          const count = key === 'ALL' ? findings.length : findings.filter((f) => f.severity === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {key === 'ALL' ? 'All' : key.toLowerCase()} {count}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 divide-y divide-border/70">
        {visible.length === 0 && (
          <li className="py-6 text-center text-[13px] text-muted-foreground">No findings in this filter.</li>
        )}
        {visible.map((f) => (
          <li key={f.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${
                  SEVERITY_BADGE[f.severity] || SEVERITY_BADGE.INFO
                }`}
              >
                {f.severity}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{f.rule_identifier}</span>
              <span className="text-[11px] text-muted-foreground">
                · {VECTOR_LABEL[f.vector_category] || f.vector_category}
              </span>
              {f.status && f.status !== 'OPEN' && (
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  {f.status.toLowerCase()}
                </span>
              )}
            </div>

            <button
              className="mt-1.5 block w-full text-left text-[13px] leading-relaxed text-foreground"
              onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
            >
              {f.issue_detected}
            </button>

            {expandedId === f.id && (
              <div className="mt-2 rounded-lg border border-border/80 bg-secondary/40 p-3 text-[12.5px]">
                {f.original_text_excerpt && (
                  <p className="text-muted-foreground">
                    In the text: <span className="font-mono text-foreground">“{f.original_text_excerpt}”</span>
                  </p>
                )}
                {f.suggested_correction && (
                  <p className="mt-1.5 text-foreground">
                    <span className="text-muted-foreground">Guardian proposes: </span>
                    {f.suggested_correction}
                  </p>
                )}
                {typeof f.character_start === 'number' && (
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    offsets {f.character_start}–{f.character_end}
                  </p>
                )}
              </div>
            )}

            {editable && f.status === 'OPEN' && (
              <div className="mt-2 flex gap-2">
                <button
                  disabled={busyId === f.id}
                  onClick={() => setStatus(f, 'ACCEPTED')}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  disabled={busyId === f.id}
                  onClick={() => setStatus(f, 'REJECTED')}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}