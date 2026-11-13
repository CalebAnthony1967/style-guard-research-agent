import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Copy,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { apiFetch } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PortalGuard from '@/components/PortalGuard';
import PageHeader from '@/components/guardian/PageHeader';
import { logEvent } from '@/lib/auditLog';
import { PORTALS } from '@/lib/portals';
import {
  ALL_DIRECTORATES,
  RESEARCH_DIRECTORATES,
  departmentsForDirectorate,
  directorateForDepartment,
} from '@/lib/orgChart';

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

function ControlRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({});
  const [stats, setStats] = useState({ manuscripts: 0, audits: 0, rules: 0, logs: 0, avg: null, byDepartment: {} });
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [resetPasswordId, setResetPasswordId] = useState(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [seedingVectors, setSeedingVectors] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'RESEARCHER',
    directorate: RESEARCH_DIRECTORATES[0].name,
    department: RESEARCH_DIRECTORATES[0].departments[0],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, statsRes, healthRes] = await Promise.all([
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/stats').catch(() => ({
          manuscripts: 0,
          audits: 0,
          rules: 0,
          logs: 0,
          avg: null,
          byDepartment: {},
        })),
        fetch('/api/health').then((r) => r.json()).catch(() => null),
      ]);
      const list = usersRes?.items || [];
      setUsers(list);
      setDraft(
        Object.fromEntries(
          list.map((u) => {
            const resolvedDir =
              u.directorate || directorateForDepartment(u.department) || RESEARCH_DIRECTORATES[0].name;
            return [
              u.id,
              {
                full_name: u.full_name || '',
                kippra_role: u.role || 'RESEARCHER',
                directorate: resolvedDir,
                department: u.department || '',
                is_active: u.is_active !== false,
              },
            ];
          }),
        ),
      );
      setStats(statsRes);
      setHealth(healthRes);
    } catch (err) {
      setError(`Managing accounts needs an administrator: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (createForm.full_name.trim().split(/\s+/).filter(Boolean).length < 2) {
      toast({
        variant: 'destructive',
        title: 'Two names required',
        description: 'Enter both First and Last name so approvals and QMS control forms carry a full officer signature.',
      });
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: createForm,
      });
      await logEvent({
        actionType: 'USER_PROVISIONED',
        user,
        summary: `Provisioned ${createForm.full_name} (${createForm.email}) as ${createForm.role} in ${createForm.department}`,
        details: {
          email: createForm.email,
          full_name: createForm.full_name,
          role: createForm.role,
          directorate: createForm.directorate,
          department: createForm.department,
        },
      });
      toast({
        title: 'Officer provisioned',
        description: `${res.user?.full_name || createForm.full_name} can now sign in immediately with password.`,
      });
      setCreateForm({
        full_name: '',
        email: '',
        password: '',
        role: 'RESEARCHER',
        directorate: RESEARCH_DIRECTORATES[0].name,
        department: RESEARCH_DIRECTORATES[0].departments[0],
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not create officer', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const save = async (u) => {
    const values = draft[u.id];
    setBusyId(u.id);
    try {
      const body = {
        full_name: values.full_name,
        role: values.kippra_role,
        directorate: values.directorate,
        department: values.department,
        is_active: values.is_active,
      };
      if (resetPasswordId === u.id && newUserPassword.trim().length >= 6) {
        body.password = newUserPassword.trim();
      }
      await apiFetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body,
      });
      await logEvent({
        actionType: 'USER_PROVISIONED',
        user,
        summary: `${values.full_name || u.email} assigned to ${values.kippra_role} (${values.department || values.directorate || 'Institute'})`,
        details: { ...values, email: u.email, password_reset: Boolean(body.password) },
      });
      toast({
        title: 'Account updated',
        description: `${values.full_name || u.email} now serves as ${PORTALS.find((p) => p.role === values.kippra_role)?.label || values.kippra_role}`,
      });
      setResetPasswordId(null);
      setNewUserPassword('');
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'The update was refused', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (u) => {
    const values = draft[u.id];
    const nextActive = !values?.is_active;
    setBusyId(u.id);
    try {
      await apiFetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: { is_active: nextActive },
      });
      await logEvent({
        actionType: 'USER_PROVISIONED',
        user,
        summary: `${u.email} ${nextActive ? 'reactivated' : 'suspended'} by administrator`,
        details: { email: u.email, is_active: nextActive },
      });
      toast({
        title: nextActive ? 'Account reactivated' : 'Account suspended',
        description: `${u.full_name || u.email} access updated.`,
      });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Status change failed', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u) => {
    setBusyId(u.id);
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      await logEvent({
        actionType: 'USER_PROVISIONED',
        user,
        summary: `Removed officer account ${u.full_name || u.email}`,
        details: { removed_user_id: u.id, email: u.email },
      });
      toast({ title: 'Officer removed', description: `${u.email} has been deleted from the directory.` });
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not remove officer', description: err.message });
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
    toast({
      title: 'Sync request recorded',
      description: 'The request is noted in the activity log with the officer who raised it.',
    });
  };

  const indexVectors = async () => {
    setSeedingVectors(true);
    try {
      const res = await apiFetch('/api/kb/seed-embeddings', { method: 'POST', body: {} });
      toast({
        title: 'Knowledge base vectors updated',
        description: `${res.updated} rules indexed across ${res.total} total standards.`,
      });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Vector indexing failed', description: err.message });
    } finally {
      setSeedingVectors(false);
    }
  };

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

  const createDepartments = departmentsForDirectorate(createForm.directorate);

  return (
    <>
      <PageHeader
        eyebrow="System administrator"
        title="Accounts & overview"
        description="Provision officers, assign roles, research directorates, and departments. Administrators do not gain access to manuscript text through this workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setShowAdd((prev) => !prev)}
              className="text-[12.5px]"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              {showAdd ? 'Close add officer' : 'Add officer'}
            </Button>
            <Button size="sm" variant="outline" onClick={indexVectors} disabled={seedingVectors} className="text-[12.5px]">
              {seedingVectors ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Index KB vectors
            </Button>
            <Button size="sm" variant="outline" onClick={requestSync} className="text-[12.5px]">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Request Microsoft 365 sync
            </Button>
          </div>
        }
      />

      {error && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}

      {health && !health.schemaReady && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[12.5px] text-amber-900 dark:text-amber-200">
          <div>
            <p className="font-semibold">Database migration required on Supabase</p>
            <p className="mt-1">
              Missing schema elements: <span className="font-mono">{(health.missingTables || []).join(', ')}</span>. Apply{' '}
              <span className="font-mono">supabase/setup_all.sql</span> in your Supabase SQL Editor to enable full workflow persistence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copySetupSql} className="text-[12px]">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy setup_all.sql
            </Button>
            <Button size="sm" variant="ghost" onClick={load} className="text-[12px]">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-check
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <section className="mt-6 rounded-xl border border-primary/30 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <h2 className="text-base font-medium text-foreground">Provision new KIPPRA officer</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Password-only sign-in · Immediate activation</span>
          </div>

          <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="new-full-name" className="text-[11.5px]">Full name (two names minimum)</Label>
              <Input
                id="new-full-name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Dr. Jane Mwangi"
                required
                className="mt-1 h-9 text-[12.5px]"
              />
            </div>

            <div>
              <Label htmlFor="new-email" className="text-[11.5px]">Official email</Label>
              <Input
                id="new-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="j.mwangi@kippra.or.ke"
                required
                className="mt-1 h-9 text-[12.5px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="new-password" className="text-[11.5px]">Initial password</Label>
                <button
                  type="button"
                  onClick={() => setCreateForm((p) => ({ ...p, password: generatePassword() }))}
                  className="text-[10.5px] font-medium text-primary hover:underline"
                >
                  Generate
                </button>
              </div>
              <Input
                id="new-password"
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="mt-1 h-9 font-mono text-[12px]"
              />
            </div>

            <div>
              <Label htmlFor="new-role" className="text-[11.5px]">Office / Rank</Label>
              <select
                id="new-role"
                value={createForm.role}
                onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground"
              >
                {PORTALS.map((p) => (
                  <option key={p.role} value={p.role}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="new-directorate" className="text-[11.5px]">Directorate / Unit</Label>
              <select
                id="new-directorate"
                value={createForm.directorate}
                onChange={(e) => {
                  const nextDir = e.target.value;
                  const nextDepts = departmentsForDirectorate(nextDir);
                  setCreateForm((p) => ({
                    ...p,
                    directorate: nextDir,
                    department: nextDepts[0] || '',
                  }));
                }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground"
              >
                {ALL_DIRECTORATES.map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="new-department" className="text-[11.5px]">Department</Label>
              <select
                id="new-department"
                value={createForm.department}
                onChange={(e) => setCreateForm((p) => ({ ...p, department: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground"
              >
                {createDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-[12px]">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creating} className="text-[12px]">
                {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
                Create &amp; assign officer
              </Button>
            </div>
          </form>
        </section>
      )}

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
          <h2 className="text-lg text-foreground">Accounts &amp; departmental assignments</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">{users.length} officers</span>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {users.map((u) => {
              const values = draft[u.id] || {
                full_name: u.full_name || '',
                kippra_role: 'RESEARCHER',
                directorate: RESEARCH_DIRECTORATES[0].name,
                department: '',
                is_active: true,
              };
              const deptOptions = departmentsForDirectorate(values.directorate);
              const isSelf = u.id === user?.id;
              return (
                <li key={u.id} className="space-y-3 p-4">
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_1.4fr_auto] lg:items-end">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            values.is_active ? 'bg-primary' : 'bg-destructive'
                          }`}
                          title={values.is_active ? 'Active' : 'Suspended'}
                        />
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        {!values.is_active && (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                            Suspended
                          </span>
                        )}
                      </div>
                      <Input
                        value={values.full_name}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [u.id]: { ...values, full_name: e.target.value } }))
                        }
                        placeholder="First and Last name"
                        className="h-8 text-[12.5px] font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Office
                      </label>
                      <select
                        value={values.kippra_role}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [u.id]: { ...values, kippra_role: e.target.value } }))
                        }
                        className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-[12px] text-foreground"
                      >
                        {PORTALS.map((p) => (
                          <option key={p.role} value={p.role}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Directorate
                        </label>
                        <select
                          value={values.directorate}
                          onChange={(e) => {
                            const nextDir = e.target.value;
                            const nextDepts = departmentsForDirectorate(nextDir);
                            const keepCurrent = nextDepts.includes(values.department);
                            setDraft((prev) => ({
                              ...prev,
                              [u.id]: {
                                ...values,
                                directorate: nextDir,
                                department: keepCurrent ? values.department : nextDepts[0] || '',
                              },
                            }));
                          }}
                          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-[12px] text-foreground"
                        >
                          {!ALL_DIRECTORATES.some((d) => d.name === values.directorate) && values.directorate && (
                            <option value={values.directorate}>{values.directorate}</option>
                          )}
                          {ALL_DIRECTORATES.map((d) => (
                            <option key={d.name} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Department
                        </label>
                        <select
                          value={values.department}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [u.id]: { ...values, department: e.target.value } }))
                          }
                          className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-[12px] text-foreground"
                        >
                          <option value="">All / Directorate-wide</option>
                          {!deptOptions.includes(values.department) && values.department && (
                            <option value={values.department}>{values.department}</option>
                          )}
                          {deptOptions.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" onClick={() => save(u)} disabled={busyId === u.id} className="text-[12px]">
                        {busyId === u.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResetPasswordId((prev) => (prev === u.id ? null : u.id));
                          setNewUserPassword('');
                        }}
                        title="Reset password"
                        className="px-2.5 text-[11.5px]"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      {!isSelf && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(u)}
                            disabled={busyId === u.id}
                            title={values.is_active ? 'Suspend account' : 'Activate account'}
                            className="px-2.5 text-[11.5px]"
                          >
                            {values.is_active ? (
                              <UserX className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-primary" />
                            )}
                          </Button>
                          {confirmDeleteId === u.id ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeUser(u)}
                              disabled={busyId === u.id}
                              className="text-[11px]"
                            >
                              Confirm delete
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(u.id)}
                              title="Remove account"
                              className="px-2 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {resetPasswordId === u.id && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11.5px] font-medium text-foreground">Set new password:</span>
                      <Input
                        type="text"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="h-8 max-w-[220px] font-mono text-[11.5px]"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNewUserPassword(generatePassword())}
                        className="h-8 text-[11px]"
                      >
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => save(u)}
                        disabled={busyId === u.id || newUserPassword.trim().length < 6}
                        className="h-8 text-[11px]"
                      >
                        Apply &amp; save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetPasswordId(null);
                          setNewUserPassword('');
                        }}
                        className="h-8 text-[11px]"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="eyebrow flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> KIPPRA Research Hierarchy &amp; Department Matrix
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {RESEARCH_DIRECTORATES.map((dir) => (
            <div key={dir.name} className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[13px] font-semibold text-foreground">{dir.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Researcher → Head of Department → Director → WIS Panel → Executive Director → KM → Publications
              </p>
              <ul className="mt-3 space-y-1.5">
                {dir.departments.map((dept) => {
                  const counts = stats.byDepartment?.[dept] || { papers: 0, officers: 0 };
                  return (
                    <li
                      key={dept}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium text-foreground">{dept}</span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular">
                        {counts.officers} officers · {counts.papers} papers
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="eyebrow flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> System overview</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ['Publication standards', stats.rules > 0 ? `${stats.rules} rules (${health?.kbEmbeddedCount ?? 0} vectorised)` : 'awaiting content'],
            ['Vector search & SQL', health?.schemaReady ? 'Supabase pgvector active' : 'migration pending'],
            ['Editorial reasoner', health?.geminiConfigured ? 'Guardian active' : 'deterministic mode'],
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