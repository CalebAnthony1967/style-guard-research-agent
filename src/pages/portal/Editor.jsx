import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import ManuscriptQueue from '@/components/guardian/ManuscriptQueue';
import LifecycleTracker from '@/components/lifecycle/LifecycleTracker';
import DiffViewer from '@/components/guardian/DiffViewer';
import { useManuscriptDetail } from '@/components/guardian/useManuscriptDetail';
import { performTransition } from '@/lib/qms';
import { stageLabel } from '@/lib/portals';

const PRODUCTION_STAGES = [
  ['EDITORIAL_FIRST_TYPESETTING', 'First editing & typesetting'],
  ['EDITORIAL_SECOND_REVIEW', 'Second editing'],
  ['AUTHOR_FEEDBACK_CYCLE', 'Author feedback cycle'],
  ['FINAL_CORRECTIONS_INCORPORATED', 'Final corrections'],
];

function ProductionDesk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stage, setStage] = useState('EDITORIAL_FIRST_TYPESETTING');
  const [dates, setDates] = useState({ commenced: '', completed: '', typesetter: '', comments: '', feedback: '', corrections: '' });
  const [spec, setSpec] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await db.manuscripts.filterByStages(
        [
          'KM_RECEIVED',
          'EDITORIAL_FIRST_TYPESETTING',
          'EDITORIAL_SECOND_REVIEW',
          'AUTHOR_FEEDBACK_CYCLE',
          'FINAL_CORRECTIONS_INCORPORATED',
          'PRINTING_REQUISITIONED',
        ],
        { limit: 30 },
      );
      setItems(list);
      setSelectedId((prev) => (list.some((m) => m.id === prev) ? prev : list[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { manuscript, control, reload } = useManuscriptDetail(selectedId);

  useEffect(() => {
    if (!control) return;
    setStage(control.current_stage?.startsWith('EDITORIAL') || control.current_stage === 'AUTHOR_FEEDBACK_CYCLE' || control.current_stage === 'FINAL_CORRECTIONS_INCORPORATED'
      ? control.current_stage
      : 'EDITORIAL_FIRST_TYPESETTING');
    setDates({
      commenced: control.typesetting_commenced || '',
      completed: control.typesetting_completed || '',
      typesetter: control.typesetting_conducted_by || '',
      comments: control.editorial_comments_sent_date || '',
      feedback: control.editorial_feedback_received_date || '',
      corrections: control.final_corrections_incorporated_date || '',
    });
    setSpec(control.print_specification || '');
  }, [control?.id, control?.current_stage]);

  const save = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({
        action: 'editorial_update',
        manuscript,
        control,
        user,
        payload: {
          stage,
          typesetting_commenced: dates.commenced,
          typesetting_completed: dates.completed,
          typesetting_conducted_by: dates.typesetter,
          editorial_comments_sent_date: dates.comments,
          editorial_feedback_received_date: dates.feedback,
          final_corrections_incorporated_date: dates.corrections,
        },
      });
      toast({ title: 'Editorial stage recorded', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not saved', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const requisition = async () => {
    if (!manuscript) return;
    setBusy(true);
    try {
      const result = await performTransition({
        action: 'print_requisition',
        manuscript,
        control,
        user,
        payload: { print_specification: spec },
      });
      toast({ title: 'Printing requisitioned', description: result.summary });
      await reload();
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'The requisition was not recorded', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, type = 'text') => (
    <div>
      <Label htmlFor={key} className="text-[12px]">{label}</Label>
      <Input
        id={key}
        type={type}
        value={dates[key]}
        onChange={(e) => setDates((prev) => ({ ...prev, [key]: e.target.value }))}
        className="mt-1.5 text-[12.5px]"
      />
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Publications Editor"
        title="Editorial & printing"
        description="Typesetting, the author feedback cycle and the printing requisition. The camera-ready export carries the editorial revisions as native Word track changes."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <p className="eyebrow mb-3">Production queue</p>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ManuscriptQueue items={items} selectedId={selectedId} onSelect={setSelectedId} emptyText="No publication is in production." />
          )}
        </aside>

        <div className="space-y-6">
          {!manuscript ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center text-[13px] text-muted-foreground">
              Nothing in production. Papers arrive once Knowledge Management receives them.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">In production · Both Research Directorates</p>
                    <h2 className="mt-1 text-xl text-foreground">{manuscript.title}</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {manuscript.paper_type} · {stageLabel(manuscript.stage)}
                      {control?.repository_handle ? ` · ${control.repository_handle}` : ''}
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

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="eyebrow">Editorial &amp; typesetting</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PRODUCTION_STAGES.map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setStage(value)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        stage === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {field('commenced', 'Typesetting commenced', 'date')}
                  {field('completed', 'Typesetting completed', 'date')}
                  {field('typesetter', 'Typesetting conducted by')}
                  {field('comments', 'Editorial comments sent', 'date')}
                  {field('feedback', 'Author feedback received', 'date')}
                  {field('corrections', 'Final corrections incorporated', 'date')}
                </div>
                <Button size="sm" onClick={save} disabled={busy} className="mt-3 text-[12.5px]">
                  {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Record editorial stage
                </Button>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="eyebrow flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Printing requisition</p>
                <Label htmlFor="spec" className="mt-3 block text-[12px]">Print specification</Label>
                <Textarea
                  id="spec"
                  rows={2}
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder="e.g. 500 copies, A5, 4-colour cover, 80gsm bond body"
                  className="mt-1.5 text-[12.5px]"
                />
                <Button size="sm" onClick={requisition} disabled={busy || !spec.trim()} className="mt-3 text-[12.5px]">
                  {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Requisition Printing
                </Button>
              </section>

              <DiffViewer manuscript={manuscript} findings={[]} audit={null} control={control} />

              <LifecycleTracker control={control} manuscript={manuscript} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Editor() {
  return (
    <PortalGuard role="PUBLICATIONS_EDITOR">
      <ProductionDesk />
    </PortalGuard>
  );
}