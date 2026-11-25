import { ButtonLink } from "../ui";

function GoogleGlyph() {
  // Monochrome "G" to stay within the flat grayscale icon language.
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.11z" />
    </svg>
  );
}

export function GoogleButton({ returnTo, label = "Continue with Google" }: { returnTo: string; label?: string }) {
  return (
    <ButtonLink href={`/auth/google?returnTo=${encodeURIComponent(returnTo)}`} icon={<GoogleGlyph />}>
      {label}
    </ButtonLink>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-neutral-600">
      <span className="h-px flex-1 bg-neutral-800" />
      {label}
      <span className="h-px flex-1 bg-neutral-800" />
    </div>
  );
}
