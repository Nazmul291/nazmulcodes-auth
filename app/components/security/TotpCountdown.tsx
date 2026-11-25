export function TotpCountdown({ secondsLeft, progress }: { secondsLeft: number; progress: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500" aria-label={`${secondsLeft} seconds until the code changes`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" />
      </svg>
      {secondsLeft}s
    </span>
  );
}
