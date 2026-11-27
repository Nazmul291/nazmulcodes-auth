/** NazmulCodes brand mark (same as nazmulcodes.org) + product label. */
export function Logo({ suffix }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-100">
      <img src="/brand-mark.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
      NazmulCodes <span className="font-normal text-neutral-500">{suffix ?? "Auth"}</span>
    </span>
  );
}
