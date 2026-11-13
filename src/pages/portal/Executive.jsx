import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
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
import { sha256 } from '@/lib/hash';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

function ExecutiveSuite() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await db.manuscripts.filterByStages(
        ['WIS_COMPLETED', 'DECISION_COMMUNICATED', 'EXECUTIVE_DIRECTOR_AUTHORIZED'],
        { limit: 30 },
      );
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
    if (!selectedId) {
      setHistory([]);
      return;
    }
    let alive = true;
    db.auditLogs
      .list({ manuscriptId: selectedId, ascending: true, limit: 60 })
      .then(async (list) => {
        const checked = await Promise.all(
          (list || []).map(async (entry) => ({
            ...entry,
            verified: (await sha256(entry.hash_input || '')) === entry.payload_hash,
          })),
        );
        if (alive) setHistory(checked);
      })
      .catch(() => {
        if (alive) setHistory([]);
      });
    return () => {
      alive = false;
    };
  }, [selectedId, busy]);

  const act = async (action, payload) => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({ action, manuscript, control, user, payload });
      toast({ title: 'Authorised', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Authorisation failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Executive Director · Station 5"
        title="Publication clearance"
        description="The full lifecycle history, Guardian's verified scorecard, and the statutory authorisation on row 11. Every signature below this line is visible here."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Cleared by seminar</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText="No paper has cleared the seminar yet."
            />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-[13px] text-muted-foreground">
              Nothing awaiting executive authorisation.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Awaiting authorisation · Cross-Directorate In-Tray</p>
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

              <section className="rounded-xl border border-border bg-card p-5">
                <p className="eyebrow flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Lifecycle history
                </p>
                {history.length === 0 ? (
                  <p className="mt-3 text-[12.5px] text-muted-foreground">
                    No audit entries recorded for this manuscript.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {history.map((entry) => (
                      <li key={entry.id} className="flex gap-3">
                        <span
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            entry.verified ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12.5px] text-foreground">
                            {entry.action_type.replace(/_/g, ' ').toLowerCase()}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              {entry.actor_email}
                            </span>
                          </p>
                          <p className="text-[11.5px] text-muted-foreground">{entry.summary}</p>
                          <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground/70">
                            {entry.created_date ? new Date(entry.created_date).toLocaleString() : ''} ·{' '}
                            {entry.verified ? 'hash verified' : 'hash mismatch'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} />

              <SignOffForm
                eyebrow="Row 11 · Statutory authorisation"
                title="Authorise for publication"
                description="This signature authorises publication under KIPPRA/QMS/RPC/2023/03 and is recorded with the score at the time of signature."
                noteLabel="Authorisation note"
                busy={busy}
                onPerform={(action, payload) => act(action, payload)}
                actions={[{ action: 'ed_authorize', label: 'Sign row 11 — authorise publication' }]}
              />

              <LifecycleTracker control={control} manuscript={manuscript} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Executive() {
  return (
    <PortalGuard role="EXECUTIVE_DIRECTOR">
      <ExecutiveSuite />
    </PortalGuard>
  );
}