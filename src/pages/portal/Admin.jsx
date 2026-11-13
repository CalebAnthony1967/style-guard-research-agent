import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Database, Loader2, RefreshCw, Save, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import { logEvent } from '@/lib/auditLog';
import { PORTALS } from '@/lib/portals';

function ControlRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({});
  const [stats, setStats] = useState({ manuscripts: 0, audits: 0, rules: 0, logs: 0, avg: null });
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.User.list();
      const list = Array.isArray(res) ? res : res?.items || [];
      setUsers(list);
      setDraft(Object.fromEntries(list.map((u) => [u.id, {
        kippra_role: u.kippra_role || u.data?.kippra_role || 'RESEARCHER',
        directorate: u.directorate || u.data?.directorate || '',
        department: u.department || u.data?.department || '',
      }])));
    } catch (err) {
      setError(`Managing accounts needs an app administrator: ${err.message}`);
    }

    const [manuscripts, audits, rules, logs, recent] = await Promise.all([
      base44.entities.Manuscript.count().catch(() => 0),
      base44.entities.ComplianceAudit.count().catch(() => 0),
      base44.entities.KnowledgeRule.count().catch(() => 0),
      base44.entities.AuditLog.count().catch(() => 0),
      base44.entities.ComplianceAudit.list({ sort: '-created_date', limit: 50 }).catch(() => ({ items: [] })),
    ]);
    const scored = (recent?.items || []).map((a) => a.overall_score).filter((n) => typeof n === 'number');
    setStats({
      manuscripts,
      audits,
      rules,
      logs,
      avg: scored.length ? Math.round(scored.reduce((s, n) => s + n, 0) / scored.length) : null,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (u) => {
    const values = draft[u.id];
    setBusyId(u.id);
    try {
      await base44.entities.User.update(u.id, {
        kippra_role: values.kippra_role,
        directorate: values.directorate,
        department: values.department,
      });
      await logEvent({
        actionType: 'USER_PROVISIONED',
        user,
        summary: `${u.email} assigned to ${values.kippra_role}`,
        details: values,
      });
      toast({ title: 'Account updated', description: `${u.email} now serves as ${PORTALS.find((p) => p.role === values.kippra_role)?.label || values.kippra_role}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'The update was refused', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const requestSync = async () => {
    await logEvent({
      actionType: 'SHAREPOINT_CDC_REQUESTED',
      user,
      summary: 'Microsoft 365 sync requested from the administration workspace',
      details: { source: 'M365 SharePoint / OneDrive', requested_by: user?.email },
    });
    toast({ title: 'Sync request recorded', description: 'The request is noted in the activity log with the officer who raised it.' });
  };

  return (
    <>
      <PageHeader
        eyebrow="System administrator"
        title="Accounts & overview"
        description="Assign offices, directorates and departments. Administrators do not gain access to manuscript text through this workspace."
        actions={
          <Button size="sm" variant="outline" onClick={requestSync} className="text-[12.5px]">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Request Microsoft 365 sync
          </Button>
        }
      />

      {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Manuscripts', stats.manuscripts],
          ['Reviews run', stats.audits],
          ['Standards references', stats.rules],
          ['Activity entries', stats.logs],
          ['Mean score', stats.avg != null ? `${stats.avg}%` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-2xl font-semibold leading-none text-brand-navy tabular">{value}</p>
            <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <Users className="h-4 w-4 text-primary" strokeWidth={1.8} />
          <h2 className="text-lg text-foreground">Accounts</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">{users.length} officers</span>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {users.map((u) => {
              const values = draft[u.id] || { kippra_role: 'RESEARCHER', directorate: '', department: '' };
              return (
                <li key={u.id} className="grid gap-3 p-4 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{u.full_name || u.email}</p>
                    <p className="text-[11px] text-muted-foreground">{u.email}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Office</label>
                    <select
                      value={values.kippra_role}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [u.id]: { ...values, kippra_role: e.target.value } }))}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-[12px] text-foreground"
                    >
                      {PORTALS.map((p) => (
                        <option key={p.role} value={p.role}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Directorate</label>
                      <Input
                        value={values.directorate}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [u.id]: { ...values, directorate: e.target.value } }))}
                        className="mt-1 h-9 text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Department</label>
                      <Input
                        value={values.department}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [u.id]: { ...values, department: e.target.value } }))}
                        className="mt-1 h-9 text-[12px]"
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={() => save(u)} disabled={busyId === u.id} className="text-[12px]">
                    {busyId === u.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="eyebrow flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> System status</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ['Publication standards', stats.rules > 0 ? 'available' : 'awaiting content'],
            ['Manuscript checks', 'run inside the Institute'],
            ['Editorial assistant', 'available to every office'],
          ].map(([label, value]) => (
            <li key={label} className="rounded-lg bg-secondary/60 p-3">
              <p className="text-[12px] font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{value}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function Admin() {
  return (
    <PortalGuard role="ADMIN">
      <ControlRoom />
    </PortalGuard>
  );
}