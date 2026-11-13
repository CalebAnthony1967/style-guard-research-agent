import { BookOpen, FileCheck2, Gauge, ScrollText } from 'lucide-react';
import PageHeader from '@/components/guardian/PageHeader';
import { PHASES } from '@/lib/lifecycle';

const SECTIONS = [
  {
    icon: ScrollText,
    title: 'KIPPRA House Style Manual (2010)',
    items: [
      'Front matter: title page, abstract, keywords and document series.',
      'Spelling: -ize forms are used except for the recognised -ise verbs.',
      'Numbers and units: thousands separated by spaces, “per cent” in running text.',
      'Tables and figures: numbered, titled, sourced and referred to in the narrative.',
      'Citations: every in-text citation appears in the bibliography, and every entry is cited.',
    ],
  },
  {
    icon: FileCheck2,
    title: 'PP/06/2020 — Policy drafting guidelines',
    items: [
      'Policy statements are written with “will” or “must”, not “shall”.',
      'Analysis projects at least fifteen years ahead of the current year.',
      'Every recommendation is evidence-based, costed where possible and assigned to an office.',
      'The nine qualities of public policy are addressed: effectiveness, efficiency, equity, inclusiveness, responsiveness, sustainability, feasibility, coherence and accountability.',
    ],
  },
  {
    icon: Gauge,
    title: 'How a paper is scored',
    items: [
      'House Style compliance — 45% of the score.',
      'Policy rigor — 35% of the score.',
      'Research output alignment — 20% of the score.',
      'A paper is ready to move forward at 80% or above, with no outstanding critical issues.',
    ],
  },
];

export default function Guidelines() {
  return (
    <>
      <PageHeader
        eyebrow="Standards"
        title="Publication guidelines"
        description="The three references Guardian applies to every manuscript, and the stages a paper passes through before it is printed."
      />

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 text-[15px] text-foreground">{s.title}</h2>
              <ul className="mt-3 space-y-2">
                {s.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="eyebrow flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Stage owners</p>
        <h2 className="mt-1 text-lg text-foreground">Who acts at each stage</h2>
        <div className="mt-3 divide-y divide-border">
          {PHASES.map((p, i) => (
            <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <p className="text-[12.5px] text-foreground">
                <span className="mr-2 text-[11px] font-semibold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                {p.title}
              </p>
              <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-brand-navy">{p.owner}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}