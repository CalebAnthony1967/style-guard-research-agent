import { useCallback, useEffect, useState } from 'react';
import { Copy, Database, Loader2, Play, RefreshCw, Send, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { apiFetch, db } from '@/lib/db';
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
import { applyCorrections, runGuardianAudit } from '@/lib/auditEngine';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';
import { logEvent } from '@/lib/auditLog';

function Workbench() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [queueView, setQueueView] = useState('mine');
  const [selectedId, setSelectedId] = useState(null);
  const [audit, setAudit] = useState(null);
  const [findings, setFindings] = useState([]);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadingRevision, setUploadingRevision] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health').then((r) => r.json());
      setHealth(res);
    } catch {
      setHealth(null);
    }
  }, []);

  const userDept = user?.data?.department || user?.department || '';

  const load = useCallback(async () => {
    if (!user?.id && !user?.email) return;
    try {
      const list =
        queueView === 'department' && userDept
          ? await db.manuscripts.listDepartment(userDept, { limit: 40 })
          : await db.manuscripts.listMine(user, { limit: 40 });
      setItems(list);
      setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, queueView, userDept]);

  useEffect(() => {
    load();
    checkHealth();
  }, [load, checkHealth]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  useEffect(() => {
    const id = manuscript?.latest_audit_id;
    if (!id) {
      setAudit(null);
      setFindings([]);
      return;
    }
    let alive = true;
    db.audits.get(id).then((a) => { if (alive) setAudit(a); }).catch(() => { if (alive) setAudit(null); });
    db.findings.filterByAudit(id, { limit: 120 })
      .then((list) => { if (alive) setFindings(list || []); })
      .catch(() => { if (alive) setFindings([]); });
    return () => { alive = false; };
  }, [manuscript?.latest_audit_id]);

  const copySetupSql = async () => {
    try {
      const res = await apiFetch('/api/setup/sql');
      await navigator.clipboard.writeText(res.sql || '');
      toast({
        title: 'Copied supabase/setup_all.sql',
        description: 'Paste into Supabase Dashboard -> SQL Editor, run it once, then click Re-check.',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not copy setup SQL', description: err.message });
    }
  };

  const runAudit = async (overrideManuscript) => {
    const target = overrideManuscript || manuscript;
    if (!target) return;
    setBusy(true);
    try {
      const result = await runGuardianAudit(target, user);
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

  const applySafeFixes = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const { text: revised, applied } = applyCorrections(manuscript.manuscript_text || '', findings);
      const nextText = revised || manuscript.revision_text || manuscript.manuscript_text;
      const updated = await db.manuscripts.update(manuscript.id, {
        manuscript_text: nextText,
        revision_text: nextText,
      });
      await logEvent({
        actionType: 'SAFE_FIXES_APPLIED',
        user,
        manuscriptId: manuscript.id,
        summary: `Applied ${applied.length} staged revisions to manuscript body`,
        details: { count: applied.length },
      });
      await runAudit(updated);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not apply fixes', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const uploadRevisedDraft = async (file) => {
    if (!manuscript || !file) return;
    setUploadingRevision(true);
    try {
      const [storagePath, scanned] = await Promise.all([
        db.storage.uploadFile(file, 'revisions'),
        db.storage.scanDocument(file, {
          kind: 'manuscript',
          fallbackDirectorate: manuscript.directorate || '',
          fallbackDepartment: manuscript.department || '',
        }),
      ]);
      const nextText = scanned?.manuscript_text || manuscript.manuscript_text || '';
      const updated = await db.manuscripts.update(manuscript.id, {
        manuscript_text: nextText,
        revision_text: nextText,
        abstract: scanned?.abstract || manuscript.abstract,
        file_uri: storagePath,
        original_filename: file.name,
        mime_type: file.type || manuscript.mime_type,
      });
      await logEvent({
        actionType: 'MANUSCRIPT_REVISION_UPLOADED',
        user,
        manuscriptId: manuscript.id,
        summary: `Revised draft uploaded and scanned: ${file.name}`,
        details: { filename: file.name, words: scanned?.word_count || 0 },
      });
      toast({ title: 'Revised draft scanned', description: `${file.name} uploaded. Running fresh compliance review…` });
      await runAudit(updated);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Revision upload failed', description: err.message });
    } finally {
      setUploadingRevision(false);
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

  const isOwner = Boolean(
    manuscript && (manuscript.user_id === user?.id || manuscript.owner_email === user?.email),
  );
  const ready = Boolean(manuscript?.can_route_to_hod) && isOwner;

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

      {health && !health.schemaReady && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[12.5px]">
          <div className="flex items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-medium text-foreground">Supabase database setup incomplete</p>
              <p className="text-muted-foreground">
                Run <span className="font-mono">supabase/setup_all.sql</span> once in your Supabase Dashboard SQL Editor to add QMS control tables and vector rules ({health.missingTables?.join(', ')}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copySetupSql} className="text-[12px]">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy setup_all.sql
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { checkHealth(); load(); }} className="text-[12px]">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-check
            </Button>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="eyebrow">{queueView === 'department' ? `${userDept || 'Department'} papers` : 'My papers'}</p>
            {userDept && (
              <div className="flex rounded-full border border-border bg-card p-0.5 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setQueueView('mine')}
                  className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                    queueView === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mine
                </button>
                <button
                  type="button"
                  onClick={() => setQueueView('department')}
                  className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                    queueView === 'department' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dept
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText={
                queueView === 'department'
                  ? `No papers submitted yet in ${userDept || 'your department'}.`
                  : 'No paper yet. Start with New submission and Guardian will scan and review it immediately.'
              }
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

                {isOwner ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => runAudit()} disabled={busy || uploadingRevision} className="text-[12.5px]">
                      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                      Review manuscript
                    </Button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary">
                      {uploadingRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploadingRevision ? 'Scanning revision…' : 'Upload revised draft'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".docx,.pdf,.txt,.md,.xlsx,.csv,.tsv"
                        disabled={busy || uploadingRevision}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) uploadRevisedDraft(f);
                        }}
                      />
                    </label>
                    {submitButton}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-[11.5px] text-muted-foreground">
                    Viewing departmental peer submission by <span className="font-medium text-foreground">{manuscript.owner_name || manuscript.owner_email}</span> (read-only).
                  </p>
                )}
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {ready
                    ? 'The paper meets the publication standard. Submitting sends it to your departmental in-tray for concept review.'
                    : `The paper is at ${manuscript.latest_score != null ? Math.round(manuscript.latest_score) : 0}%. Resolve the critical issues to unlock submission.`}
                </p>
              </section>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} editable={isOwner} />

              <LifecycleTracker control={control} manuscript={manuscript} action={ready ? submitButton : null} />

              <div className="grid gap-6 xl:grid-cols-2">
                <DiffViewer
                  manuscript={manuscript}
                  findings={findings}
                  audit={audit}
                  control={control}
                  onApplyFixes={isOwner ? applySafeFixes : undefined}
                />
                <GuardianChat
                  manuscript={manuscript}
                  audit={audit}
                  findings={findings}
                  control={control}
                  user={user}
                  mode="CO_PILOT_EDIT"
                  className="min-h-[420px]"
                  onApplyPatch={async (updated, patch) => {
                    toast({ title: 'Co-Pilot rewrite applied', description: patch.summary || 'Re-evaluating compliance score…' });
                    await runAudit(updated);
                  }}
                  onRunAudit={() => runAudit()}
                  prompts={[
                    'Why is my policy rigor score low?',
                    'Rewrite all "shall" policy statements to comply with PP/06/2020',
                    'What must change to reach the 80% publication standard?',
                  ]}
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