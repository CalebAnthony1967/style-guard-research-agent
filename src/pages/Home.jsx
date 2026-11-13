import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileSearch, Scale } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { portalForRole, ROLE_LABEL, roleOf, STAGES, loggedInLabel } from '@/lib/portals';
import PortalGrid from '@/components/home/PortalGrid';

const ARCHITECTURE_STEPS = [
  {
    n: '1',
    name: 'User query / task',
    role: 'Intake',
    summary: 'Guided three-step workbench and voice ingress.',
    points: ['Series, sandbox upload and TOR benchmark', 'Web Audio voice captured and transcribed'],
  },
  {
    n: '3',
    name: 'LLM — the brain',
    role: 'Reasoning',
    summary: 'Guardian Core Reasoner at temperature 0.0.',
    points: ['Deterministic evaluation harness', 'Cloud open-source model with local switch'],
  },
  {
    n: '4',
    name: 'Memory — the notebook',
    role: 'State',
    summary: 'Threaded session memory and ETag version control.',
    points: ['Chat thread per manuscript session', 'SHA-256 version hashes prevent race conditions'],
  },
  {
    n: '2',
    name: 'RAG — the library',
    role: 'Retrieval',
    summary: 'Hybrid dense and sparse retrieval over KIPPRA knowledge.',
    points: [
      'House Style Manual 2010 · 57 checklist points',
      'PP/06/2020 policy drafting guidelines',
      'Knowledge-base rules with relevance scoring',
    ],
  },
  {
    n: '6',
    name: 'MCP — universal adapter',
    role: 'Protocol',
    summary: 'One standard interface between the reasoner and every capability.',
    points: ['QMS control gateway', 'Repository harvester, compliance linter, track-changes'],
  },
  {
    n: '5',
    name: 'Tools — the hands',
    role: 'Execution',
    summary: 'Deterministic linting, citation parity and OpenXML patching.',
    points: [
      '-ise / -ize, "shall", table numerals, per cent',
      '1:1 citation-to-bibliography parity',
      'Word track-changes diff generation',
    ],
  },
  {
    n: '7',
    name: 'A2A — communication line',
    role: 'Orchestration',
    summary: 'Typed shared state passed between agents.',
    points: ['Event bus with findings and hand-offs', 'Every agent step recorded for audit'],
  },
  {
    n: '8',
    name: 'Multi-agent system — the team',
    role: 'Pipeline',
    summary: 'Research, planning, execution and review agents in a DAG.',
    points: [
      'Research harvests precedent and style rules',
      'Planning builds the audit checklist',
      'Execution lints and drafts revisions',
      'Review scores and quality-gates at 80%',
    ],
  },
  {
    n: '9',
    name: 'Final response / action',
    role: 'Delivery',
    summary: 'Track-changes export, scorecard, QMS control card and voice reply.',
    points: ['Compliance scorecard with 9-qualities radar', 'Digital control card with human sign-off'],
  },
];

const PRINCIPLES = [
  {
    icon: Scale,
    title: 'Human sign-off at every gate',
    body: 'Guardian evaluates and recommends. Only an officer of the Institute can sign a control-form row.',
  },
  {
    icon: FileSearch,
    title: 'Explainable by construction',
    body: 'Every deduction traces to a rule code, a character range and the guideline that produced it.',
  },
  {
    icon: CheckCircle2,
    title: 'Append-only audit trail',
    body: 'Each action is hash-chained with its predecessor, so records cannot be quietly rewritten.',
  },
];

function ArchTimeline() {
  return (
    <ol className="relative mt-10 space-y-0">
      {ARCHITECTURE_STEPS.map((step, index) => (
        <motion.li
          key={step.n}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="group relative grid grid-cols-[auto_1fr] gap-5 pb-7 last:pb-0"
        >
          <div className="relative flex flex-col items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-sm text-primary shadow-[0_1px_0_hsl(var(--border))] transition-colors group-hover:border-primary/40">
              {step.n}
            </span>
            {index < ARCHITECTURE_STEPS.length - 1 && (
              <span
                className="mt-1 w-px flex-1 bg-gradient-to-b from-border via-border to-transparent"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-lg leading-tight text-foreground">{step.name}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {step.role}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {step.points.map((pt) => (
                <li key={pt} className="text-[12.5px] text-foreground/70">
                  <span className="mr-1.5 text-primary/40">—</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

export default function Home() {
  const { user } = useAuth();
  const activeRole = roleOf(user);
  const portal = portalForRole(activeRole);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg text-primary-foreground">
              G
            </span>
            <div className="leading-tight">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                KIPPRA StyleGuard
              </p>
              <p className="text-sm font-medium text-foreground">Guardian</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link to="/guidelines" className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline">
              Guidelines
            </Link>
            <span className="hidden text-xs font-medium text-foreground sm:inline">
              {loggedInLabel(user)}
            </span>
            <Link
              to={portal.path}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open my portal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute inset-0 opacity-[0.5]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="eyebrow"
              >
                Nine-component agent system · QMS KIPPRA/QMS/RPC/2023/03
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="mt-5 text-[2.6rem] leading-[1.05] text-foreground sm:text-6xl"
              >
                Manuscript compliance,
                <br />
                governed end to end.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground"
              >
                Guardian lints every KIPPRA manuscript against the 57-point House Style and PP/06/2020, retrieves
                precedent from the E-Repository, drafts native Word revisions, and holds each paper at the 80% threshold
                until a human signs it forward.
              </motion.p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={portal.path}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Enter {portal.label} portal <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#architecture"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  See the architecture
                </a>
              </div>
              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-y-6 border-t border-border/80 pt-6 sm:grid-cols-4 sm:gap-4">
                {[
                  ['57', 'checklist points'],
                  ['14', 'QMS stages'],
                  ['9', 'policy qualities'],
                  ['80%', 'routing gate'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="font-display text-3xl leading-none text-foreground tabular">{value}</dt>
                    <dd className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="self-start rounded-xl border border-border bg-card p-6 shadow-[0_18px_50px_-32px_hsl(205_45%_12%/0.5)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Research &amp; Publications Control Form
                  </p>
                  <p className="mt-1 font-display text-xl text-foreground">KIPPRA/QMS/RPC/2023/03</p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Rev 3
                </span>
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Lifecycle</p>
                  <p className="font-mono text-[10px] text-muted-foreground">14 stages</p>
                </div>
                <div className="mt-2 flex h-9 items-end gap-1">
                  {STAGES.map((stage, i) => (
                    <span
                      key={stage.key}
                      title={stage.label}
                      className="flex-1 rounded-sm bg-secondary"
                      style={{ height: `${34 + ((i * 13) % 46)}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-border/80 pt-5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Compliance gate</span>
                  <span className="font-mono text-foreground">&ge; 80% → HOD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Linter mode</span>
                  <span className="font-mono text-foreground">deterministic</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sign-off</span>
                  <span className="font-mono text-foreground">human, per row</span>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-secondary/70 p-4">
                <p className="text-[12.5px] leading-relaxed text-foreground/80">
                  “A paper does not advance because the model is confident. It advances because an officer read the
                  findings and signed.”
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Guardian operating principle
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="architecture" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <p className="eyebrow">The system</p>
              <h2 className="mt-3 text-3xl text-foreground sm:text-4xl">How StyleGuard works</h2>
            </div>
            <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
              One-to-one mapping to the nine-component architecture: intake, brain and memory, library, adapter, tools,
              event bus, agent team and final verified artifact.
            </p>
          </div>
          <ArchTimeline />
        </section>

        <section className="border-y border-border/70 bg-card/60">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Nine portals</p>
                <h2 className="mt-3 text-3xl text-foreground sm:text-4xl">One per accountable role</h2>
              </div>
              <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Each officer sees only their station in the lifecycle. Access is resolved from your assigned role, so a
                departmental in-tray is never mixed with a directorate queue.
              </p>
            </div>
            <PortalGrid activeRole={activeRole} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {PRINCIPLES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-background p-6">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  <h3 className="mt-4 text-lg text-foreground">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>KIPPRA StyleGuard · Guardian multi-agent compliance system</p>
          <p className="font-mono">House Style Manual 2010 · PP/06/2020 · QMS Rev 3</p>
        </div>
      </footer>
    </div>
  );
}