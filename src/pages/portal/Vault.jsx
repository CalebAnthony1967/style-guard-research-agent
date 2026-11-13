import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, Fingerprint, KeyRound, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import { issueKeyShares, loadSessions, loadShares, openBreakGlass } from '@/lib/vault';
import { verifyAuditChain } from '@/lib/auditLog';

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
  const [codes, setCodes] = useState(['', '', '']);
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState([]);
  const [chain, setChain] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [auditPage, biasPage, shareList, sessionList] = await Promise.all([
      base44.entities.ComplianceAudit.list({ sort: '-created_date', limit: 12 }).catch(() => ({ items: [] })),
      base44.entities.ComplianceFinding.filter({ rule_identifier: 'KIPPRA-HS-BIAS-02' }, { sort: '-created_date', limit: 40 }).catch(() => ({ items: [] })),
      loadShares().catch(() => []),
      loadSessions().catch(() => []),
    ]);
    const list = auditPage?.items || [];
    setAudits(list);
    setSelectedAudit((prev) => (list.some((a) => a.id === prev) ? prev : list[0]?.id || null));
    setBias(biasPage?.items || []);
    setShares(shareList);
    setSessions(sessionList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedAudit) { setFindings([]); return; }
    let alive = true;
    base44.entities.ComplianceFinding.filter({ audit_id: selectedAudit }, { sort: '-created_date', limit: 60 })
      .then((p) => { if (alive) setFindings(p?.items || []); });
    return () => { alive = false; };
  }, [selectedAudit]);

  const audit = audits.find((a) => a.id === selectedAudit) || null;

  const issue = async () => {
    setBusy(true);
    try {
      const fresh = await issueKeyShares(user);
      setIssued(fresh);
      await load();
      toast({ title: 'Emergency access codes issued', description: 'Record the three codes now. Only their fingerprints are kept.' });
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
      toast({ title: 'Emergency session opened', description: `Closes at ${new Date(session.expires_at).toLocaleTimeString()}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'The session was refused', description: err.message });
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

  const activeShareCount = shares.filter((s) => s.is_active).length;

  return (
    <>
      <PageHeader
        eyebrow="AI ethics & explainability"
        title="Governance vault"
        description="Why every score was given, which language was flagged, and who approved what. No change can be made without two custodians."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Reviews indexed', audits.length],
          ['Language flags', bias.length],
          ['Emergency codes active', `${activeShareCount} of 3`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular">{value}</p>
          </div>
        ))}
      </div>

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
                    selectedAudit === a.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
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
              <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {sessions.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    {actionText(s.status)} · {s.shares_verified} codes · closes {s.expires_at ? new Date(s.expires_at).toLocaleString() : '—'}
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
            <p className="eyebrow">Activity log</p>
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