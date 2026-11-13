import { useCallback, useEffect, useState } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import AuditPanel from '@/components/guardian/AuditPanel';
import SignOffForm from '@/components/guardian/SignOffForm';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';
import { departmentsForDirectorate } from '@/lib/orgChart';

function DirectorateDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const directorate = user?.data?.directorate || user?.directorate;
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [horizonFindings, setHorizonFindings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const childDepartments = directorate ? departmentsForDirectorate(directorate) : undefined;
      const list = await db.manuscripts.filterByStages(
        ['DRAFT_PRESENTED_DEPT', 'DIRECTOR_REVIEW_COMPLETED', 'WIS_SCHEDULED', 'WIS_COMPLETED'],
        { directorate: directorate || undefined, departments: childDepartments, limit: 40 },
      );
      setItems(list);
      setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }, [directorate]);

  useEffect(() => {
    load();
  }, [load]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  useEffect(() => {
    const auditId = manuscript?.latest_audit_id;
    if (!auditId) {
      setHorizonFindings([]);
      return;
    }
    let alive = true;
    db.findings
      .filterByAudit(auditId, { limit: 120 })
      .then((list) => {
        if (!alive) return;
        setHorizonFindings(
          (list || []).filter(
            (f) =>
              ['PP062020-PLAN-15', 'KIPPRA-TOR-ALIGN-01'].includes(f.rule_identifier) ||
              f.vector_category === 'OUTPUT_ALIGNMENT',
          ),
        );
      })
      .catch(() => {
        if (alive) setHorizonFindings([]);
      });
    return () => {
      alive = false;
    };
  }, [manuscript?.latest_audit_id]);

  const act = async (action, payload) => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({ action, manuscript, control, user, payload });
      toast({ title: 'Signed', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Action refused', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Director · Station 3"
        title="Directorate review desk"
        description={`Papers cleared by departmental heads${directorate ? ` in the ${directorate}` : ''}. You hold rows 7, 8 and 10 — the review, the clearance to seminar, and the communication of the panel decision.`}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Directorate queue</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText="No paper has reached directorate level."
            />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-[13px] text-muted-foreground">
              Nothing at directorate level. Papers arrive once an HOD signs row 6.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="eyebrow">Now reviewing</p>
                <h2 className="mt-1 text-xl text-foreground">{manuscript.title}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {manuscript.paper_type} · {manuscript.department || 'department not set'}
                  {manuscript.directorate ? ` (${manuscript.directorate})` : ''} · {stageLabel(manuscript.stage)}
                </p>
              </div>

              <section className="rounded-xl border border-border bg-card p-5">
                <p className="eyebrow flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" /> Strategic horizon auditor
                </p>
                <h3 className="mt-1 text-lg text-foreground">Fifteen-year horizon &amp; output alignment</h3>
                {horizonFindings.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    No horizon or TOR alignment gaps were raised in the latest audit.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {horizonFindings.map((f) => (
                      <li key={f.id} className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-[12.5px]">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {f.rule_identifier}
                        </p>
                        <p className="mt-1 text-foreground">{f.issue_detected}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} />

              <SignOffForm
                eyebrow="Rows 7, 8 & 10"
                title="Directorate clearance"
                description="Row 7 records the completed review, row 8 clears the paper to the Weekly Internal Seminar, and row 10 records that the panel decision was communicated to the author."
                noteLabel="Review note (recorded in the audit trail)"
                busy={busy}
                onPerform={(action, payload) => act(action, payload)}
                actions={[
                  { action: 'director_review', label: 'Sign row 7 — review completed' },
                  { action: 'director_clear_wis', label: 'Sign row 8 — clear to WIS' },
                  { action: 'decision_communicated', label: 'Sign row 10 — communicate decision', variant: 'outline' },
                ]}
              />

              <LifecycleTracker control={control} manuscript={manuscript} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Director() {
  return (
    <PortalGuard role="DIRECTOR">
      <DirectorateDesk />
    </PortalGuard>
  );
}