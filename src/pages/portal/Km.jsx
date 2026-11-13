import { useCallback, useEffect, useState } from 'react';
import { BookPlus, Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import AuditPanel from '@/components/guardian/AuditPanel';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

function KmDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [handle, setHandle] = useState('');
  const [isbn, setIsbn] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await db.manuscripts.filterByStages(
        ['EXECUTIVE_DIRECTOR_AUTHORIZED', 'KM_RECEIVED'],
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
    if (manuscript) {
      setHandle(control?.repository_handle || `kippra-${manuscript.id.slice(0, 8)}`);
      setIsbn(manuscript.isbn || '');
    }
  }, [manuscript?.id, control?.repository_handle]);

  const receive = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({
        action: 'km_receive',
        manuscript,
        control,
        user,
        payload: { handle, isbn },
      });
      toast({ title: 'Received and indexed', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Ingestion failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Deputy Director, Knowledge Management · Station 6"
        title="Repository intake"
        description="Authorised publications arrive here for handle and ISBN allocation. Receiving a paper also loads it into the Guardian knowledge base, so future audits can cite it."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Ingestion queue</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText="No authorised publication is waiting for intake."
            />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-[13px] text-muted-foreground">
              The ingestion queue is empty.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">Authorised publication · Both Research Directorates</p>
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
                  <BookPlus className="h-3.5 w-3.5" /> Repository ingestion
                </p>
                <h2 className="mt-1 text-lg text-foreground">Row 12 — received for publication</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="handle" className="text-[12px]">
                      Repository handle
                    </Label>
                    <Input
                      id="handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="mt-1.5 font-mono text-[12.5px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="isbn" className="text-[12px]">
                      ISBN allocation
                    </Label>
                    <Input
                      id="isbn"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder="978-9966-…"
                      className="mt-1.5 font-mono text-[12.5px]"
                    />
                  </div>
                </div>
                {manuscript.repository_uri && (
                  <p className="mt-3 break-all rounded-lg bg-secondary/60 p-3 font-mono text-[11px] text-muted-foreground">
                    {manuscript.repository_uri}
                  </p>
                )}
                <Button size="sm" onClick={receive} disabled={busy || !handle.trim()} className="mt-3 text-[12.5px]">
                  {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Receive &amp; index into the knowledge base
                </Button>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  Indexing writes a repository rule into the knowledge base and marks the title retrievable for future
                  precedent checks. No file leaves the Institute.
                </p>
              </section>

              <AuditPanel auditId={manuscript.latest_audit_id} manuscript={manuscript} control={control} />

              <LifecycleTracker control={control} manuscript={manuscript} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Km() {
  return (
    <PortalGuard role="DEPUTY_DIRECTOR_KM">
      <KmDesk />
    </PortalGuard>
  );
}