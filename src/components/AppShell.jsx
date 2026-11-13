import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, FileText, Home, Inbox, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { PORTALS, roleOf, portalForRole, getPreviewRole, setPreviewRole, officeTitle, ROLE_LABEL } from '@/lib/portals';

const NAV = [
  { label: 'Home', to: '/', icon: Home, end: true },
  { label: 'My Papers', to: '/portal/researcher', icon: FileText },
  { label: 'Guidelines', to: '/guidelines', icon: BookOpen },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(getPreviewRole());
  const own = roleOf(user);
  const acting = preview || own;
  const inboxPath = portalForRole(acting).path;

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const switchOffice = (next) => {
    setPreviewRole(next === own ? '' : next);
    setPreview(next === own ? '' : next);
    navigate(portalForRole(next).path);
  };

  const navItem = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
      isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-secondary hover:text-sidebar-foreground'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pb-4 pt-5">
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground">K</span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">KIPPRA</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">StyleGuard</span>
          </span>
        </Link>
        <span className="crest-rule mt-4 block h-[3px] w-full rounded-full" />
      </div>

      <div className="px-3">
        <button
          onClick={() => go(inboxPath)}
          className="flex w-full items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5 text-left text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/40"
        >
          <Inbox className="h-4 w-4 text-primary" strokeWidth={1.8} />
          <span className="flex-1">Review In-Tray</span>
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{ROLE_LABEL[acting] || 'Researcher'}</span>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={navItem} onClick={() => setOpen(false)}>
              <Icon className="h-4 w-4" strokeWidth={1.7} />
              {item.label}
            </NavLink>
          );
        })}

        <div className="pt-4">
          <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Role switcher
          </p>
          <label className="mt-1 flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
            <select
              value={acting}
              onChange={(e) => switchOffice(e.target.value)}
              className="w-full cursor-pointer appearance-none bg-transparent text-[12.5px] font-medium text-foreground outline-none"
              aria-label="Preview a different office"
            >
              {PORTALS.map((p) => (
                <option key={p.role} value={p.role}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </label>
          {preview && preview !== own && (
            <button
              onClick={() => switchOffice(own)}
              className="mt-2 w-full rounded-md bg-accent px-2.5 py-1.5 text-left text-[11px] font-medium text-accent-foreground"
            >
              Previewing {ROLE_LABEL[preview]} · return to my office
            </button>
          )}
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="rounded-md bg-secondary/70 px-3 py-2.5">
          <p className="truncate text-[12.5px] font-medium text-foreground">{user?.full_name || user?.email || 'Officer'}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{officeTitle(user)}</p>
        </div>
        <button
          onClick={() => logout()}
          className="mt-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.7} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-border lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-border">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open navigation" className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-foreground">KIPPRA StyleGuard</Link>
          <button className="ml-auto text-muted-foreground" onClick={() => logout()} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {open && (
          <button className="fixed right-4 top-4 z-[60] text-foreground lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        )}
        <main className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-8 sm:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}