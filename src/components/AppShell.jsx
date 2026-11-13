import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  FileText,
  Home,
  Inbox,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  PORTALS,
  roleOf,
  portalForRole,
  getPreviewRole,
  setPreviewRole,
  officeTitle,
  ROLE_LABEL,
} from '@/lib/portals';
import { firstNameOf } from '@/lib/orgChart';
import AmbientBackground from '@/components/AmbientBackground';

const NAV = [
  { label: 'Home', to: '/', icon: Home, end: true },
  { label: 'My Papers', to: '/portal/researcher', icon: FileText },
  { label: 'Guidelines', to: '/guidelines', icon: BookOpen },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs sm:text-[13px] font-medium transition-colors min-h-[44px] ${
      isActive
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-sidebar-foreground/75 hover:bg-secondary hover:text-sidebar-foreground'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col bg-card/95 text-sidebar-foreground backdrop-blur-md">
      <div className="px-5 pb-4 pt-5">
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
            K
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-foreground">KIPPRA</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              StyleGuard
            </span>
          </span>
        </Link>
        <span className="crest-rule mt-4 block h-[3px] w-full rounded-full" />
      </div>

      <div className="px-3">
        <button
          onClick={() => go(inboxPath)}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs sm:text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 active:scale-[0.99]"
        >
          <Inbox className="h-4 w-4 text-primary shrink-0" strokeWidth={1.8} />
          <span className="flex-1 truncate">Review In-Tray</span>
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-bold text-accent-foreground">
            {ROLE_LABEL[acting] || 'Researcher'}
          </span>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={navItem} onClick={() => setOpen(false)}>
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              {item.label}
            </NavLink>
          );
        })}

        <div className="pt-4">
          <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Station Preview
          </p>
          <label className="mt-1 flex min-h-[42px] items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
            <select
              value={acting}
              onChange={(e) => switchOffice(e.target.value)}
              className="w-full cursor-pointer appearance-none bg-transparent text-xs sm:text-[12.5px] font-medium text-foreground outline-none"
              aria-label="Preview a different office"
            >
              {PORTALS.map((p) => (
                <option key={p.role} value={p.role}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </label>
          {preview && preview !== own && (
            <button
              onClick={() => switchOffice(own)}
              className="mt-2 w-full rounded-lg bg-accent px-2.5 py-1.5 text-left text-[11px] font-medium text-accent-foreground"
            >
              Previewing {ROLE_LABEL[preview]} · return to my office
            </button>
          )}
        </div>
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="rounded-xl bg-secondary/70 px-3 py-2.5">
          <p className="truncate text-xs sm:text-[12.5px] font-semibold text-foreground">
            Logged in: {firstNameOf(user)}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] sm:text-[11px] text-muted-foreground">{officeTitle(user)}</p>
        </div>
        <button
          onClick={() => logout()}
          className="mt-2 flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <AmbientBackground />

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-border/80 lg:block">
        {sidebar}
      </aside>

      {/* Mobile Drawer Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] sm:w-[320px] max-w-[85vw] border-r border-border shadow-2xl">
            {sidebar}
          </div>
          <button
            className="fixed right-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-md shadow-md"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Main Viewport Container */}
      <div className="lg:pl-[264px]">
        {/* Mobile Sticky Top App Bar (Compact & Touch Ergonomic) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-3.5 sm:px-6 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary active:scale-[0.96]"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="truncate text-sm sm:text-base font-bold tracking-tight text-foreground">
            KIPPRA StyleGuard
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden xs:inline-block max-w-[120px] sm:max-w-[160px] truncate text-[11px] font-medium text-muted-foreground">
              {firstNameOf(user)}
            </span>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-[0.96]"
              onClick={() => logout()}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="mx-auto w-full max-w-[1180px] px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-9">
          <Outlet />
        </main>

        {/* Mobile Bottom Thumb Bar (Thumb-Zone Ergonomics on Small Screens) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex h-15 items-center justify-around border-t border-border/80 bg-card/90 px-2 backdrop-blur-md lg:hidden"
          aria-label="Mobile Navigation"
        >
          <Link
            to="/"
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-h-[44px] min-w-[50px] text-[10px] font-medium transition-colors ${
              location.pathname === '/' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>

          <Link
            to="/portal/researcher"
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-h-[44px] min-w-[50px] text-[10px] font-medium transition-colors ${
              location.pathname.startsWith('/portal/researcher') ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Papers</span>
          </Link>

          <Link
            to={inboxPath}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-h-[44px] min-w-[50px] text-[10px] font-medium transition-colors ${
              location.pathname === inboxPath ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>In-Tray</span>
          </Link>

          <Link
            to="/guidelines"
            className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-h-[44px] min-w-[50px] text-[10px] font-medium transition-colors ${
              location.pathname === '/guidelines' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Standards</span>
          </Link>

          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-h-[44px] min-w-[50px] text-[10px] font-medium text-muted-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
            <span>Offices</span>
          </button>
        </nav>
      </div>
    </div>
  );
}