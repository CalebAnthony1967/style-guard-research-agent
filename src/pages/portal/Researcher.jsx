import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import AuditPanel from '@/components/guardian/AuditPanel';
import DiffViewer from '@/components/guardian/DiffViewer';
import GuardianChat from '@/components/guardian/GuardianChat';
import IntakeWizard from '@/components/guardian/IntakeWizard';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { runGuardianAudit } from '@/lib/auditEngine';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

function Workbench() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [audit, setAudit] = useState(null);
  const [findings, setFindings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.email) return;
    const page = await base44.entities.Manuscript.filter(
      { $or: [{ owner_email: user.email }, { created_by_id: user.id }] },
      { sort: '-updated_date', limit: 40 },
    );
    const list = page?.items || [];
    setItems(list);
    setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    setLoading(false);
  }, [user?.email, user?.id]);

  useEffect(() => { load(); }, [load]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  useEffect(() => {
    const id = manuscript?.latest_audit_id;
    if (!id) {
      setAudit(null);
      setFindings([]);
      return;
    }
    let alive = true;
    base44.entities.ComplianceAudit.get(id).then((a) => { if (alive) setAudit(a); }).catch(() => { if (alive) setAudit(null); });
    base44.entities.ComplianceFinding.filter({ audit_id: id }, { sort: '-created_date', limit: 120 })
      .then((p) => { if (alive) setFindings(p?.items || []); });
    return () => { alive = false; };
  }, [manuscript?.latest_audit_id]);

  const runAudit = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await runGuardianAudit(manuscript, user);
      toast({
        title: `Review complete — ${result.lint.overall}%`,
        description: `${result.lint.findings.length} issues found · ${result.lint.critical} critical · ${result.revision.applied.length} suggested revisions prepared`,
      });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'The review could not complete', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({ action: 'researcher_submit', manuscript, control, user });
      toast({ title: 'Submitted to your Head of Department', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Submission blocked', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(manuscript?.can_route_to_hod);

  const submitButton = (
    <Button
      size="sm"
      onClick={submit}
      disabled={busy || !ready}
      className="text-[12.5px]"
      title={ready ? 'Send the paper to your departmental in-tray' : 'Resolve the critical issues first'}
    >
      <Send className="mr-1.5 h-3.5 w-3.5" /> Submit to HOD for Concept Review
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Researcher workspace"
        title="My papers"
        description="Submit a paper, review it against KIPPRA publication standards, apply the suggested revisions, then route it to your Head of Department."
        actions={<IntakeWizard user={user} onCreated={(m) => { setSelectedId(m.id); load(); }} />}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <p className="eyebrow mb-3">My papers</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText="No paper yet. Start with New submission and Guardian will review it immediately."
            />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center">
              <p className="text-xl font-semibold text-foreground">Your workspace is empty</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Submit a manuscript and Guardian evaluates it against the House Style Manual and PP/06/2020 before it
                reaches your department.
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-lg">
                    <p className="eyebrow">Compliance status</p>
                    <h2 className="mt-1 text-xl leading-snug text-foreground">{manuscript.title}</h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span className="rounded-full bg-brand-burgundy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-burgundy">
                        {manuscript.paper_type}
                      </span>
                      {stageLabel(manuscript.stage)} · {manuscript.department || 'department not set'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[2.4rem] font-semibold leading-none text-foreground tabular">
                      {manuscript.latest_score != null ? `${Math.round(manuscript.latest_score)}` : '—'}
                      <span className="text-lg">%</span>
                    </p>
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                      ready ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {ready ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {ready ? 'Ready to submit' : 'Revisions required'}
                    </span>
                  </div>
                </div>

                {manuscript.supervisory_note && (
                  <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-destructive">Supervisory feedback</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">{manuscript.supervisory_note}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={runAudit} disabled={busy} className="text-[12.5px]">
                    {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                    Review manuscript
                  </Button>
                  {submitButton}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {ready
                    ? 'The paper meets the publication standard. Submitting sends it to your departmental in-tray for concept review.'
                    : `The paper is at ${manuscript.latest_score != null ? Math.round(manuscript.latest_score) : 0}%. Resolve the critical issues to unlock submission.`}
                </p>
              </section>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} editable />

              <LifecycleTracker control={control} manuscript={manuscript} action={ready ? submitButton : null} />

              <div className="grid gap-6 xl:grid-cols-2">
                <DiffViewer manuscript={manuscript} findings={findings} audit={audit} control={control} />
                <GuardianChat
                  manuscript={manuscript}
                  audit={audit}
                  findings={findings}
                  user={user}
                  mode="CO_PILOT_EDIT"
                  className="min-h-[420px]"
                  prompts={['Why is my policy rigor score low?', 'Show me the wording issues found', 'What must change to reach the publication standard?']}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Researcher() {
  return (
    <PortalGuard role="RESEARCHER">
      <Workbench />
    </PortalGuard>
  );
}