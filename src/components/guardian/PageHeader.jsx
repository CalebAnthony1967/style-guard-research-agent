export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 border-b border-border pb-5 sm:pb-6">
      <div className="max-w-2xl min-w-0">
        {eyebrow && <p className="eyebrow text-xs">{eyebrow}</p>}
        <h1 className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl lg:text-[2.1rem] font-bold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-xs sm:text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}