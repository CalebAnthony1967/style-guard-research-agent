import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PORTALS } from '@/lib/portals';

export default function PortalGrid({ activeRole }) {
  return (
    <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {PORTALS.map((portal) => {
        const Icon = portal.icon;
        const isCurrent = portal.role === activeRole;
        return (
          <Link
            key={portal.role}
            to={portal.path}
            className={`group relative flex flex-col justify-between gap-4 p-5 transition-colors duration-300 ${
              isCurrent ? 'bg-accent/50' : 'bg-card hover:bg-secondary/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.6} />
              </span>
              {isCurrent && (
                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-primary-foreground">
                  your portal
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base text-foreground">{portal.label}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{portal.blurb}</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary/70 transition-colors group-hover:text-primary">
              Enter <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}