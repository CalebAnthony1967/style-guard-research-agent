import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { officeTitle, portalForRole, roleOf } from '@/lib/portals';
import PageHeader from '@/components/guardian/PageHeader';
import { Button } from '@/components/ui/button';

export default function Settings() {
  const { user, logout } = useAuth();
  const role = roleOf(user);
  const portal = portalForRole(role);
  const directorate = user?.data?.directorate || user?.directorate || 'Not assigned';
  const department = user?.data?.department || user?.department || 'Not assigned';

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Officer settings"
        description="Your assigned KIPPRA office, organisational placement and account security controls."
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="eyebrow flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Assigned office
          </p>
          <h2 className="mt-1 text-lg text-foreground">{user?.full_name || user?.email || 'Officer'}</h2>
          <dl className="mt-4 divide-y divide-border/70 text-[13px]">
            <div className="flex items-baseline justify-between py-2.5">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{user?.email || '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <dt className="text-muted-foreground">Office</dt>
              <dd className="font-medium text-foreground">{officeTitle(user)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <dt className="text-muted-foreground">Directorate</dt>
              <dd className="font-medium text-foreground">{directorate}</dd>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium text-foreground">{department}</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-[11.5px] text-muted-foreground">
            QMS digital signatures stamp: <span className="font-medium text-foreground">{user?.full_name || 'Not set'} · {portal.label}</span>
          </div>
          <div className="mt-4">
            <Button asChild size="sm" variant="outline" className="text-[12.5px]">
              <Link to={portal.path}>Open {portal.label} portal</Link>
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </p>
            <h2 className="mt-1 text-lg text-foreground">Authentication &amp; access</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Sign in with your Institute email and password, or request a password reset.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Two-factor authentication setup commented out per password-only policy:
            <Button asChild size="sm" className="text-[12.5px]">
              <Link to="/mfa?returnTo=%2Fsettings">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Manage two-factor auth
              </Link>
            </Button>
            */}
            <Button asChild size="sm" variant="outline" className="text-[12.5px]">
              <Link to="/forgot-password">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset password
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => logout()} className="text-[12.5px]">
              Sign out
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}