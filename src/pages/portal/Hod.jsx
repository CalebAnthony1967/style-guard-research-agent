import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import AuditPanel from '@/components/guardian/AuditPanel';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import SignOffForm from '@/components/guardian/SignOffForm';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

function DepartmentDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const dept = user?.data?.department || user?.department;
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await db.manuscripts.filterByStages(
        ['DRAFT_SUBMITTED', 'CONCEPT_PRESENTED_DEPT', 'DRAFT_PRESENTED_DEPT'],
        { department: dept || undefined, limit: 40 },
      );
      setItems(list);
      setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }, [dept]);

  useEffect(() => { load(); }, [load]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  const act = async (action, payload) => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({ action, manuscript, control, user, payload });
      toast({ title: 'Approved and recorded', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'The action was refused', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Head of Department"
        title="Departmental in-tray"
        description={`Papers submitted by researchers${dept ? ` in ${dept}` : ''}. The compliance summary stands in for the first read; your approval is what moves the paper to the next stage.`}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Awaiting your approval</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue items={items} selectedId={selectedId} onSelect={setSelectedId} emptyText="No paper is waiting at departmental level." />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center text-[13px] text-muted-foreground">
              The in-tray is clear. Papers appear here the moment a researcher submits one.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Now reviewing</p>
                    <h2 className="mt-1 text-xl text-foreground">{manuscript.title}</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {manuscript.owner_name || manuscript.owner_email} · {manuscript.paper_type} · {stageLabel(manuscript.stage)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-foreground">
                    {manuscript.latest_score != null ? `${Math.round(manuscript.latest_score)}% compliant` : 'Not yet reviewed'}
                  </span>
                </div>
                {manuscript.supervisory_note && (
                  <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-[12px] text-muted-foreground">
                    Previous note: {manuscript.supervisory_note}
                  </p>
                )}
              </div>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} />

              <SignOffForm
                eyebrow="Departmental approval"
                title="Approve the paper forward"
                description="Approving the concept presentation records that the department accepted the idea; approving the draft records that it was presented. Returning sends the paper back to the author with your comments."
                noteLabel="Comments (required when returning the paper)"
                busy={busy}
                onPerform={(action, payload) => act(action, payload)}
                actions={[
                  { action: 'hod_sign_concept', label: 'Approve Concept Presentation' },
                  { action: 'hod_sign_draft', label: 'Approve Draft Presentation' },
                  { action: 'hod_return', label: 'Return with Comments', variant: 'outline' },
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

export default function Hod() {
  return (
    <PortalGuard role="HOD">
      <DepartmentDesk />
    </PortalGuard>
  );
}