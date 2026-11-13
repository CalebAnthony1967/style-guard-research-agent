import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import AuditPanel from '@/components/guardian/AuditPanel';
import GuardianChat from '@/components/guardian/GuardianChat';
import SignOffForm from '@/components/guardian/SignOffForm';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

const DECISIONS = [
  {
    value: 'SUBMIT_FOR_PUBLICATION',
    label: 'Submit for publication',
    hint: 'Proceeds to the Executive Director',
  },
  {
    value: 'REVISE_SUBMIT_MINOR',
    label: 'Revise and submit',
    hint: 'Minor comments; author re-submits',
  },
  {
    value: 'REVISE_REPRESENT_MAJOR',
    label: 'Revise and present again',
    hint: 'Major comments; resets to department',
  },
];

function SeminarConsole() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [decision, setDecision] = useState('SUBMIT_FOR_PUBLICATION');
  const [comments, setComments] = useState('');
  const [audit, setAudit] = useState(null);
  const [findings, setFindings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await db.manuscripts.filterByStages(['WIS_SCHEDULED', 'WIS_COMPLETED'], { limit: 30 });
      setItems(list);
      setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  useEffect(() => {
    const auditId = manuscript?.latest_audit_id;
    if (!auditId) {
      setAudit(null);
      setFindings([]);
      return;
    }
    let alive = true;
    db.audits
      .get(auditId)
      .then((a) => {
        if (alive) setAudit(a);
      })
      .catch(() => {});
    db.findings
      .filterByAudit(auditId, { limit: 100 })
      .then((list) => {
        if (alive) setFindings(list || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [manuscript?.latest_audit_id]);

  const act = async (action, payload) => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({ action, manuscript, control, user, payload });
      toast({ title: 'Panel decision recorded', description: result.summary });
      setComments('');
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Decision not recorded', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Weekly Internal Seminar · Station 4"
        title="Panel console"
        description="Everything in this console is advisory until the panel records its binding decision on row 9. Guardian can fact-check a claim against the repository while you are in session."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Seminar docket</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText="No paper is scheduled for seminar."
            />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-[13px] text-muted-foreground">
              The docket is empty. Papers appear once a director signs row 8.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Before the panel · Cross-Directorate Docket</p>
                    <h2 className="mt-1 text-xl text-foreground">{manuscript.title}</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {manuscript.paper_type} · {manuscript.owner_name || manuscript.owner_email} ·{' '}
                      {stageLabel(manuscript.stage)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                      Origin: {manuscript.department || 'Unassigned'}
                    </span>
                    {manuscript.directorate && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
                        {manuscript.directorate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <SignOffForm
                eyebrow="Row 9 · Binding panel decision"
                title="Record the verdict"
                description="This is a human-in-the-loop entry. The decision is written to the control form and sealed in the audit trail."
                busy={busy}
                onPerform={() => act('seminar_decision', { decision, note: comments })}
                extra={
                  <div className="mt-3 space-y-2">
                    {DECISIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDecision(opt.value)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          decision === opt.value
                            ? 'border-primary/50 bg-accent/50'
                            : 'border-border bg-background hover:bg-secondary/40'
                        }`}
                      >
                        <span
                          className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${
                            decision === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}
                        />
                        <span>
                          <span className="block text-[12.5px] text-foreground">{opt.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                        </span>
                      </button>
                    ))}
                    <Textarea
                      rows={2}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Panel comments recorded against the decision"
                      className="text-[12.5px]"
                    />
                  </div>
                }
                actions={[{ action: 'seminar_decision', label: 'Record decision on row 9' }]}
              />

              <GuardianChat
                manuscript={manuscript}
                audit={audit}
                findings={findings}
                user={user}
                mode="SEMINAR_FACT_CHECK"
                className="min-h-[380px]"
                prompts={[
                  'Does this contradict past KIPPRA papers?',
                  'Which claims lack citation?',
                  'Summarise the panel’s likely objections',
                ]}
              />

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} />

              <LifecycleTracker control={control} manuscript={manuscript} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Seminar() {
  return (
    <PortalGuard role="SEMINAR_PANEL">
      <SeminarConsole />
    </PortalGuard>
  );
}