export default function ScoreRing({ score = 0, size = 128, caption, locked = false }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = (size - 9) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safeScore / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${safeScore}% compliance`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={9} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={locked ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[2rem] leading-none text-foreground tabular">
          {Math.round(safeScore)}
          <span className="text-base">%</span>
        </span>
        {caption && (
          <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{caption}</span>
        )}
      </div>
    </div>
  );
}