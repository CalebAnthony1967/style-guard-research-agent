import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  Scale,
  ShieldCheck,
  Sparkles,
  Users2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { portalForRole, roleOf, loggedInLabel } from '@/lib/portals';
import PortalGrid from '@/components/home/PortalGrid';
import AmbientBackground from '@/components/AmbientBackground';

const ARCHITECTURE_STEPS = [
  {
    n: '1',
    name: 'Manuscript Intake',
    role: 'Intake Agent',
    summary: 'Upload documents or terms of reference for automatic scanning and extraction.',
    points: ['Automated series, abstract, and section recognition', 'Benchmark comparison against policy objectives'],
  },
  {
    n: '2',
    name: 'Knowledge & Precedents',
    role: 'Library Agent',
    summary: 'Retrieves relevant KIPPRA publications and official style guidelines.',
    points: [
      'Comprehensive House Style checklist checks',
      'Policy paper drafting standards and guidance',
      'Live precedent matching from the institute repository',
    ],
  },
  {
    n: '3',
    name: 'Quality Reasoning',
    role: 'Reasoning Engine',
    summary: 'Evaluates manuscripts against core public policy qualities.',
    points: ['Rigorous multi-point quality assessment', 'Deterministic checks with zero hallucinations'],
  },
  {
    n: '4',
    name: 'Session Memory',
    role: 'Audit History',
    summary: 'Maintains versioned track records and tamper-evident logs for every paper.',
    points: ['Dedicated discussion thread per manuscript', 'Cryptographic hashing prevents lost or altered edits'],
  },
  {
    n: '5',
    name: 'Compliance Linter',
    role: 'Execution Tools',
    summary: 'Scans spelling, grammar, tables, figures, and citation parity.',
    points: [
      'Checks spelling (-ise/-ize), word usage, and percentages',
      'Verifies 1:1 match between citations and references',
      'Generates native Word Track Changes revisions',
    ],
  },
  {
    n: '6',
    name: 'Universal Gateway',
    role: 'Integration Hub',
    summary: 'Connects the reviewer tools directly with institute repositories and formats.',
    points: ['Seamless QMS workflow hand-offs', 'Repository harvester and document diff engine'],
  },
  {
    n: '7',
    name: 'Collaborative Event Line',
    role: 'Orchestrator',
    summary: 'Routes document findings smoothly between review stages.',
    points: ['Structured hand-off between author and officers', 'Complete event log recorded for accountability'],
  },
  {
    n: '8',
    name: 'Multi-Agent Team',
    role: 'Review Pipeline',
    summary: 'Coordinated specialist agents assisting research, editing, and quality assurance.',
    points: [
      'Scans precedent and house style benchmarks',
      'Builds prioritized revision recommendations',
      'Flags exclusionary language for gender neutrality',
      'Guarantees 80% quality threshold before hand-off',
    ],
  },
  {
    n: '9',
    name: 'Verified Output',
    role: 'Final Delivery',
    summary: 'Provides Word revisions, compliance scorecards, and signed approval records.',
    points: ['Comprehensive 9-dimension policy scorecard', 'Clear digital approval record ready for publishing'],
  },
];

const PRINCIPLES = [
  {
    icon: Scale,
    title: 'Human accountability at every stage',
    body: 'Guardian provides automated assistance and recommendations. Publication authority always rests with accountable Institute officers.',
  },
  {
    icon: FileSearch,
    title: 'Explainable and transparent',
    body: 'Every suggestion is traced to a specific guideline and exact text excerpt so authors understand exactly why a change is advised.',
  },
  {
    icon: CheckCircle2,
    title: 'Tamper-evident audit trail',
    body: 'Each approval and transition is digitally sealed with cryptographic verification, ensuring an immutable record of review.',
  },
];

const WORKFLOW_MILESTONES = [
  {
    step: '1',
    title: 'Author Draft',
    role: 'Researcher',
    desc: 'Submission & initial style compliance',
  },
  {
    step: '2',
    title: 'Department Review',
    role: 'Head of Department',
    desc: 'Concept & draft presentation sign-off',
  },
  {
    step: '3',
    title: 'Seminar & Clearance',
    role: 'WIS Panel & Director',
    desc: 'Peer panel scrutiny & executive authorization',
  },
  {
    step: '4',
    title: 'Publishing Desk',
    role: 'KM & Publications',
    desc: 'Repository indexing, typesetting & printing',
  },
];

function ArchTimeline() {
  return (
    <ol className="relative mt-8 sm:mt-10 space-y-0">
      {ARCHITECTURE_STEPS.map((step, index) => (
        <motion.li
          key={step.n}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
          className="group relative grid grid-cols-[auto_1fr] gap-3 sm:gap-5 pb-6 sm:pb-7 last:pb-0"
        >
          <div className="relative flex flex-col items-center">
            <span className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-xs sm:text-sm font-semibold text-primary shadow-sm transition-colors group-hover:border-primary/50">
              {step.n}
            </span>
            {index < ARCHITECTURE_STEPS.length - 1 && (
              <span
                className="mt-1 w-px flex-1 bg-gradient-to-b from-border via-border/80 to-transparent"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h3 className="text-base sm:text-lg font-semibold leading-tight text-foreground">{step.name}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[9.5px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
                {step.role}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.summary}</p>
            <ul className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1">
              {step.points.map((pt) => (
                <li key={pt} className="text-xs sm:text-[12.5px] text-foreground/80 flex items-start">
                  <span className="mr-1.5 text-primary/60 shrink-0">—</span>
                  <span>{pt}</span>
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
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <AmbientBackground />

      {/* Responsive Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary font-display text-base sm:text-lg text-primary-foreground shadow-sm">
              K
            </span>
            <div className="leading-tight">
              <p className="text-xs sm:text-sm font-bold tracking-tight text-foreground">
                KIPPRA StyleGuard
              </p>
              <p className="hidden xs:block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Guardian AI System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              to="/guidelines"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" /> Guidelines
            </Link>

            {user && (
              <span className="hidden sm:inline-block max-w-[190px] truncate text-xs text-muted-foreground">
                {loggedInLabel(user)}
              </span>
            )}

            <Link
              to={portal.path}
              className="inline-flex min-h-[38px] sm:min-h-[40px] items-center gap-1.5 rounded-full bg-primary px-3.5 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
            >
              <span className="hidden xs:inline">Open</span> {portal.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-24 lg:px-8">
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Research Publication Quality &amp; Compliance</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight text-foreground leading-[1.1] text-balance"
              >
                Manuscript compliance, governed end to end.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.15 }}
                className="mt-4 sm:mt-6 max-w-xl text-sm sm:text-base leading-relaxed text-muted-foreground"
              >
                Guardian assists researchers and institute leaders across every step of publication: reviewing style
                compliance, verifying citation parity against the e-repository, generating Word revisions, and routing
                papers through official departmental and executive sign-offs.
              </motion.p>

              <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-3">
                <Link
                  to={portal.path}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
                >
                  Enter {portal.label} Portal <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#workflow"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-card/80 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
                >
                  Explore Workflow
                </a>
              </div>

              {/* Quick Metrics Bar */}
              <dl className="mt-8 sm:mt-12 grid grid-cols-2 gap-4 border-t border-border/80 pt-6 sm:grid-cols-4">
                {[
                  ['57', 'Style Guidelines'],
                  ['14', 'Approval Stages'],
                  ['9', 'Policy Qualities'],
                  ['80%', 'Quality Gate'],
                ].map(([value, label]) => (
                  <div key={label} className="p-1">
                    <dt className="font-display text-2xl sm:text-3xl font-bold leading-none text-foreground tabular">
                      {value}
                    </dt>
                    <dd className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Redesigned Executive Quality Pathway Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full self-start rounded-2xl border border-border/90 bg-card/90 p-5 sm:p-6 lg:p-7 shadow-lg shadow-black/5 backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                <div>
                  <div className="flex items-center gap-1.5 text-primary text-[11px] font-semibold uppercase tracking-wider">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span>Governance Pathway</span>
                  </div>
                  <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    Research Quality &amp; Approval Journey
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Official KIPPRA Research Quality Framework
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent/60 px-2.5 py-1 text-[10px] font-semibold text-accent-foreground">
                  Active System
                </span>
              </div>

              {/* Intuitive 4-Phase Milestone Pathway */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Standard 4-Phase Progression</span>
                  <span>14 Official Stages</span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WORKFLOW_MILESTONES.map((m) => (
                    <div
                      key={m.step}
                      className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-secondary/40 p-2.5 transition-colors hover:bg-secondary/70"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {m.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{m.title}</p>
                        <p className="text-[11px] text-primary/80 font-medium">{m.role}</p>
                        <p className="text-[10.5px] text-muted-foreground leading-snug">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clear Human-First Quality Standards */}
              <div className="mt-5 space-y-2.5 border-t border-border/70 pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Quality Standard</span>
                  <span className="font-semibold text-foreground text-right">&ge; 80% score required to advance</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Review Method</span>
                  <span className="font-medium text-foreground text-right">Objective checks against institute rules</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Sign-off Authority</span>
                  <span className="font-medium text-foreground text-right">Accountable officers per stage</span>
                </div>
              </div>

              {/* Operating Principle Callout */}
              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs sm:text-[13px] italic leading-relaxed text-foreground/90">
                  “A research paper does not advance simply because an algorithm is confident. It moves forward when
                  an accountable officer reviews the evidence and signs.”
                </p>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-primary">
                    Core Institutional Principle
                  </span>
                  <span>Human-in-the-Loop</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* System Architecture Section */}
        <section id="architecture" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">System Capabilities</p>
              <h2 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                How StyleGuard works
              </h2>
            </div>
            <p className="max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Intelligent multi-agent assistance supporting manuscript intake, reference matching, automated style
              linting, and official clearance.
            </p>
          </div>
          <ArchTimeline />
        </section>

        {/* Portals Section */}
        <section id="workflow" className="border-y border-border/70 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Users2 className="h-3.5 w-3.5" /> Accountable Stations
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                  Dedicated portals for every role
                </h2>
              </div>
              <p className="max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Every officer accesses the workspace designed specifically for their mandate—from researchers and
                department heads to directors and editors.
              </p>
            </div>
            <PortalGrid activeRole={activeRole} />
          </div>
        </section>

        {/* Core Principles Section */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20 lg:px-8">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {PRINCIPLES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/80 bg-card/70 p-5 sm:p-6 shadow-sm transition-all hover:border-primary/40 hover:bg-card"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-base sm:text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Clean, Mobile-Adaptive Footer without raw handbook codes */}
      <footer className="relative z-10 border-t border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                K
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">KIPPRA StyleGuard</p>
                <p className="text-xs text-muted-foreground">
                  Kenya Institute for Public Policy Research and Analysis
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <Link to="/guidelines" className="hover:text-foreground transition-colors">
                Guidelines
              </Link>
              <Link to="/portal/researcher" className="hover:text-foreground transition-colors">
                Research Portal
              </Link>
              <Link to="/settings" className="hover:text-foreground transition-colors">
                Settings
              </Link>
              <Link to="/portal/vault" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> Governance Vault
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground text-center sm:text-left">
            <p>© {new Date().getFullYear()} KIPPRA. All rights reserved.</p>
            <p className="text-[11.5px] text-muted-foreground/80">
              Responsible AI &amp; Research Compliance Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}