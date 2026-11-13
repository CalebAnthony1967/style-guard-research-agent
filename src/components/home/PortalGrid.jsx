import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PORTALS } from '@/lib/portals';

export default function PortalGrid({ activeRole }) {
  return (
    <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {PORTALS.map((portal) => {
        const Icon = portal.icon;
        const isCurrent = portal.role === activeRole;
        return (
          <Link
            key={portal.role}
            to={portal.path}
            className={`group relative flex flex-col justify-between gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-200 active:scale-[0.99] ${
              isCurrent
                ? 'border-primary/50 bg-primary/5 shadow-sm'
                : 'border-border/80 bg-card/80 hover:border-primary/30 hover:bg-card shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border transition-colors ${
                  isCurrent
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/80 bg-background text-primary group-hover:border-primary/30'
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} />
              </span>
              {isCurrent && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[9.5px] uppercase font-bold tracking-wider text-primary">
                  Your Office
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {portal.label}
              </h3>
              <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                {portal.blurb}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/80 transition-colors group-hover:text-primary">
              Enter Workspace <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}