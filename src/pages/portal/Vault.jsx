import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Download,
  Eye,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiFetch, db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import { issueKeyShares, loadSessions, loadShares, openBreakGlass } from '@/lib/vault';
import { verifyAuditChain } from '@/lib/auditLog';
import { ROLE_LABEL } from '@/lib/portals';

const WEIGHTS = [
  { label: 'House Style Compliance', weight: '45%', detail: 'Layout, spelling, tables, citations' },
  { label: 'Policy Rigor', weight: '35%', detail: 'PP/06/2020 principles and horizon' },
  { label: 'Research Output Alignment', weight: '20%', detail: 'Expected outputs located in the text' },
];

const TRAIL_LABEL = {
  'Research Agent': 'Standards review',
  'Planning Agent': 'Checklist planning',
  'Execution Agent': 'Manuscript review',
  'Review Agent': 'Quality review',
};

const sourceLabel = (identifier = '') => {
  if (identifier.includes('CHECKLIST')) return `House Style Manual · item ${identifier.split('-').pop()}`;
  if (identifier.startsWith('PP062020')) return 'PP/06/2020 · policy drafting';
  if (identifier.startsWith('BIAS')) return 'House Style Manual · inclusive language';
  if (identifier.startsWith('TOR')) return 'Terms of reference';
  return 'KIPPRA publication standards';
};

const actionText = (value = '') => value.replace(/_/g, ' ').toLowerCase();

function VaultSuite() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [audits, setAudits] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [findings, setFindings] = useState([]);
  const [bias, setBias] = useState([]);
  const [shares, setShares] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [sweepReport, setSweepReport] = useState(null);
  const [sweeping, setSweeping] = useState(false);
  const [codes, setCodes] = useState(['', '', '']);
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState([]);
  const [chain, setChain] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, biasList, shareList, sessionList, ethicsRes] = await Promise.all([
      db.audits.list({ limit: 12 }).catch(() => []),
      db.findings.filterByRule('KIPPRA-HS-BIAS-02', { limit: 40 }).catch(() => []),
      loadShares().catch(() => []),
      loadSessions().catch(() => []),
      apiFetch('/api/vault/ethics-report').catch(() => null),
    ]);
    setAudits(list);
    setSelectedAudit((prev) => (list.some((a) => a.id === prev) ? prev : list[0]?.id || null));
    setBias(biasList);
    setShares(shareList);
    setSessions(sessionList);
    setTelemetry(ethicsRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedAudit) {
      setFindings([]);
      return;
    }
    let alive = true;
    db.findings
      .filterByAudit(selectedAudit, { limit: 60 })
      .then((list) => {
        if (alive) setFindings(list || []);
      })
      .catch(() => {
        if (alive) setFindings([]);
      });
    return () => {
      alive = false;
    };
  }, [selectedAudit]);

  const audit = audits.find((a) => a.id === selectedAudit) || null;

  const issue = async () => {
    setBusy(true);
    try {
      const fresh = await issueKeyShares(user);
      setIssued(fresh);
      await load();
      toast({
        title: 'Emergency access codes issued',
        description: 'Record the three codes now. Only their fingerprints are kept.',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Codes could not be issued', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    try {
      const session = await openBreakGlass({ user, codes, reason });
      setCodes(['', '', '']);
      setReason('');
      await load();
      toast({
        title: 'Emergency session opened',
        description: `Closes at ${new Date(session.expires_at).toLocaleTimeString()}`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'The session was refused', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const closeSession = async (sessionId) => {
    setBusy(true);
    try {
      await apiFetch(`/api/vault/break-glass/${sessionId}/close`, { method: 'POST', body: {} });
      toast({ title: 'Session closed', description: 'Emergency break-glass access revoked early.' });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not close session', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const result = await verifyAuditChain();
      setChain(result);
      toast({
        title: result.verified ? 'Records verified' : 'A record has changed',
        description: `${result.total} entries checked.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Verification could not run', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const runEthicsSweep = async () => {
    setSweeping(true);
    try {
      const freshTelemetry = telemetry || (await apiFetch('/api/vault/ethics-report').catch(() => ({})));
      const report = await apiFetch('/api/vault/ethics-sweep', {
        method: 'POST',
        body: { metrics: freshTelemetry },
      });
      setSweepReport(report);
      toast({
        title: 'AI Ethics & Security sweep complete',
        description: `Verdict: ${report.verdict || 'VERIFIED'}`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Ethics sweep failed', description: err.message });
    } finally {
      setSweeping(false);
    }
  };

  const exportLedger = async () => {
    setBusy(true);
    try {
      const result = chain || (await verifyAuditChain());
      if (!chain) setChain(result);
      const bundle = {
        exported_at: new Date().toISOString(),
        exported_by: user?.email,
        chain_verified: result.verified,
        total_entries: result.total,
        telemetry,
        sweep_report: sweepReport,
        records: result.records,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kippra-ethics-ledger-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Verified ledger exported', description: 'JSON governance package downloaded.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Export failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const activeShareCount = shares.filter((s) => s.is_active).length;

  return (
    <>
      <PageHeader
        eyebrow="AI ethics &amp; security governance"
        title="Governance vault"
        description="Free, fair, safe, secure, and transparent oversight: inspect scoring parity across directorates, monitor data privacy, verify human sign-offs, and enforce two-custodian custody."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={runEthicsSweep} disabled={sweeping} className="text-[12.5px]">
              {sweeping ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Run AI Ethics Sweep
            </Button>
            <Button size="sm" variant="outline" onClick={exportLedger} disabled={busy} className="text-[12.5px]">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Verified Ledger
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Reviews indexed', audits.length],
          ['Language flags', bias.length],
          ['Directorate spread', telemetry ? `${telemetry.maxSpread ?? 0} pts` : '—'],
          ['PII safety alerts', telemetry ? telemetry.piiAlerts?.length ?? 0 : '—'],
          ['Emergency codes active', `${activeShareCount} of 3`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular">{value}</p>
          </div>
        ))}
      </div>

      {sweepReport && (
        <section className="mt-6 rounded-xl border border-primary/30 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Certification Verdict
              </p>
              <h2 className="mt-0.5 text-lg text-foreground">{sweepReport.verdict?.replace(/_/g, ' ')}</h2>
            </div>
            <div className="flex gap-3 text-[12px]">
              <span className="rounded-lg bg-secondary/70 px-3 py-1.5 font-medium tabular">
                Fairness: <strong>{sweepReport.fairness_score}%</strong>
              </span>
              <span className="rounded-lg bg-secondary/70 px-3 py-1.5 font-medium tabular">
                Safety: <strong>{sweepReport.safety_score}%</strong>
              </span>
              <span className="rounded-lg bg-secondary/70 px-3 py-1.5 font-medium tabular">
                Transparency: <strong>{sweepReport.transparency_score}%</strong>
              </span>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{sweepReport.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(sweepReport.checks || []).map((c, idx) => (
              <div key={`${c.pillar}-${idx}`} className="rounded-lg border border-border/70 bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-foreground">{c.pillar}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      c.status === 'PASS'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{c.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {telemetry && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="eyebrow flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Fairness parity</p>
            <h2 className="mt-1 text-base font-medium text-foreground">Scoring across research directorates</h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Identical deterministic weights apply to both Research Directorates. Target spread ≤ 15 pts.
            </p>
            <ul className="mt-3 space-y-2">
              {(telemetry.parity || []).map((p) => (
                <li key={p.directorate} className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-foreground">{p.directorate}</span>
                    <span className="font-mono font-semibold text-primary tabular">
                      {p.meanScore != null ? `${p.meanScore}%` : '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.papers} audited · {p.passRate != null ? `${p.passRate}% ≥ 80% threshold` : 'no scored drafts yet'}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="eyebrow flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Data safety &amp; privacy</p>
            <h2 className="mt-1 text-base font-medium text-foreground">PII &amp; human sign-off check</h2>
            <div className="mt-3 space-y-2.5">
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-foreground">Human-in-the-loop sign-off integrity</span>
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    {telemetry.unverifiedTransitions === 0 ? '100% signed' : `${telemetry.unverifiedTransitions} unverified`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No stage advance is permitted without an explicit named human officer and rank.
                </p>
              </div>
              {telemetry.piiAlerts?.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[12px] text-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>No unredacted Kenyan phone numbers, National IDs, or financial identifiers found across stored manuscripts.</span>
                </div>
              ) : (
                <ul className="max-h-[150px] space-y-1.5 overflow-y-auto">
                  {telemetry.piiAlerts.map((alert) => (
                    <li key={alert.id} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11.5px]">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                      <div>
                        <p className="font-medium text-foreground">{alert.title}</p>
                        <p className="text-muted-foreground">{alert.department} · {alert.flags.join(', ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="eyebrow flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Security transparency</p>
            <h2 className="mt-1 text-base font-medium text-foreground">Privileged signatory officers</h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {telemetry.activeOfficers} active · {telemetry.suspendedOfficers} suspended across the Institute
            </p>
            <ul className="mt-3 max-h-[200px] space-y-1.5 overflow-y-auto">
              {(telemetry.privilegedOfficers || []).slice(0, 12).map((officer) => (
                <li key={officer.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-[11.5px]">
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-medium text-foreground">{officer.full_name || officer.email}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {ROLE_LABEL[officer.role] || officer.role} {officer.department ? `· ${officer.department}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold uppercase ${officer.is_active === false ? 'text-destructive' : 'text-primary'}`}>
                    {officer.is_active === false ? 'suspended' : 'active'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <p className="eyebrow flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Explainability</p>
            <h2 className="mt-1 text-lg text-foreground">Why the score is what it is</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {audits.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAudit(a.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    selectedAudit === a.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {Math.round(a.overall_score)}%
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : !audit ? (
            <p className="p-5 text-[12.5px] text-muted-foreground">No review has been completed yet.</p>
          ) : (
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {WEIGHTS.map((w) => (
                  <div key={w.label} className="rounded-lg bg-secondary/60 p-2.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">{w.weight}</p>
                    <p className="mt-0.5 text-[11.5px] font-medium text-foreground">{w.label}</p>
                    <p className="text-[10.5px] leading-relaxed text-muted-foreground">{w.detail}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="eyebrow">Where points were deducted</p>
                <ul className="mt-2 space-y-2">
                  {findings.filter((f) => f.severity !== 'INFO').slice(0, 8).map((f) => (
                    <li key={f.id} className="rounded-lg border border-border/70 bg-secondary/30 p-2.5">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{sourceLabel(f.rule_identifier)}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{f.issue_detected}</p>
                    </li>
                  ))}
                  {findings.length === 0 && <li className="text-[12px] text-muted-foreground">No deductions in this review.</li>}
                </ul>
              </div>

              <div>
                <p className="eyebrow">Review trail</p>
                <ol className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
                  {(audit.agent_trace || []).map((s, i) => (
                    <li key={`${s.agent}-${i}`} className="flex items-baseline justify-between gap-2">
                      <span className="text-foreground">{TRAIL_LABEL[s.agent] || s.agent}</span>
                      <span>{s.status === 'COMPLETED' ? 'Completed' : s.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-5">
              <p className="eyebrow flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Responsible AI</p>
              <h2 className="mt-1 text-lg text-foreground">Inclusive language review</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                Gender-neutral and non-sexist language checks required by the House Style Manual.
              </p>
            </div>
            <ul className="max-h-[220px] divide-y divide-border/60 overflow-y-auto">
              {bias.length === 0 && <li className="p-5 text-[12.5px] text-muted-foreground">No exclusionary language has been flagged.</li>}
              {bias.map((f) => (
                <li key={f.id} className="flex items-start gap-3 p-3.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-burgundy" />
                  <div>
                    <p className="text-[12.5px] text-foreground">{f.issue_detected}</p>
                    <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                      {f.status === 'ACCEPTED' ? 'accepted' : f.status === 'REJECTED' ? 'rejected' : 'awaiting author'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="eyebrow flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Emergency access</p>
            <h2 className="mt-1 text-lg text-foreground">Two custodians, thirty minutes</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              A change outside the normal lifecycle needs two of the three codes held by different officers. Every
              session closes automatically and is recorded with its reason.
            </p>

            <Button size="sm" variant="outline" onClick={issue} disabled={busy} className="mt-3 text-[12px]">
              Issue a fresh set of three codes
            </Button>

            {issued.length > 0 && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-accent/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-foreground">Shown once</p>
                <ul className="mt-1 space-y-0.5">
                  {issued.map((c) => <li key={c} className="font-mono text-[12px] text-foreground">{c}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Input
                  key={i}
                  value={codes[i]}
                  onChange={(e) => setCodes((prev) => prev.map((c, idx) => (idx === i ? e.target.value.toUpperCase() : c)))}
                  placeholder={`Code ${i + 1}`}
                  className="font-mono text-[11.5px]"
                />
              ))}
            </div>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is emergency access needed?"
              className="mt-2 text-[12px]"
            />
            <Button size="sm" onClick={open} disabled={busy} className="mt-3 text-[12px]">
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Open a 30-minute session
            </Button>

            {sessions.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                {sessions.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-border/50 px-2.5 py-1.5">
                    <span>
                      {actionText(s.status)} · {s.shares_verified} codes · closes{' '}
                      {s.expires_at ? new Date(s.expires_at).toLocaleString() : '—'}
                    </span>
                    {s.status === 'OPEN' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => closeSession(s.id)}
                        disabled={busy}
                        className="h-6 px-2 text-[10.5px] text-destructive"
                      >
                        Close early
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity log</p>
            <h2 className="mt-1 text-lg text-foreground">Every review and approval, in order</h2>
          </div>
          <Button size="sm" variant="outline" onClick={verify} disabled={busy} className="text-[12px]">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            Verify records
          </Button>
        </div>
        {!chain ? (
          <p className="p-5 text-[12.5px] leading-relaxed text-muted-foreground">
            Run verification to confirm that each entry still matches what was recorded, and that the sequence has not
            been altered.
          </p>
        ) : (
          <ul className="max-h-[320px] divide-y divide-border/60 overflow-y-auto">
            {chain.records.slice(0, 30).map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                {r.verified ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" /> : <ShieldX className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-foreground">{actionText(r.action_type)} · {r.actor_email}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {r.created_date ? new Date(r.created_date).toLocaleString() : ''}
                  </p>
                </div>
                <span className={`ml-auto text-[10px] font-semibold uppercase tracking-[0.06em] ${r.verified ? 'text-primary' : 'text-destructive'}`}>
                  {r.verified ? 'verified' : 'changed'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Vault() {
  return (
    <PortalGuard role="SUPER_ADMIN_VAULT">
      <VaultSuite />
    </PortalGuard>
  );
}