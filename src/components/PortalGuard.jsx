import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canOpenPortal, portalForRole, roleOf, ROLE_LABEL } from '@/lib/portals';

export default function PortalGuard({ role, children }) {
  const { user } = useAuth();
  const home = portalForRole(roleOf(user));

  if (!canOpenPortal(user, role)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
        <LockKeyhole className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="mt-4 text-2xl text-foreground">This station is not yours</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Your account holds the {ROLE_LABEL[roleOf(user)] || 'Researcher'} office. The {ROLE_LABEL[role]} workspace is designated for officers accountable for that stage in the review workflow.
        </p>
        <Link
          to={home.path}
          className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
        >
          Open my portal
        </Link>
      </div>
    );
  }

  return children;
}