export default function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Soft emerald / forest ambient glow */}
      <div
        className="animate-ambient-1 absolute -right-24 -top-24 h-[320px] w-[320px] rounded-full bg-primary/10 blur-[90px] sm:h-[460px] sm:w-[460px] sm:blur-[120px] lg:h-[620px] lg:w-[620px]"
      />

      {/* Institutional navy / sapphire ambient glow */}
      <div
        className="animate-ambient-2 absolute -bottom-32 -left-28 h-[340px] w-[340px] rounded-full bg-brand-navy/10 blur-[100px] sm:h-[500px] sm:w-[500px] sm:blur-[130px] lg:h-[680px] lg:w-[680px]"
      />

      {/* Subtle burgundy warm highlight */}
      <div
        className="animate-ambient-3 absolute left-1/3 top-1/4 h-[260px] w-[260px] rounded-full bg-brand-burgundy/5 blur-[80px] sm:h-[380px] sm:w-[380px] sm:blur-[110px] lg:h-[480px] lg:w-[480px]"
      />

      {/* Very faint architectural dot texture overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.025] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] dark:opacity-[0.035]" />
    </div>
  );
}
