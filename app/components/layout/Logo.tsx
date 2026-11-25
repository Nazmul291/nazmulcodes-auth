import { ShieldCheck } from "lucide-react";

export function Logo({ suffix }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-100">
      <span className="grid h-7 w-7 place-items-center rounded-md border border-neutral-800 bg-neutral-900">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </span>
      NazmulCodes <span className="font-normal text-neutral-500">{suffix ?? "Auth"}</span>
    </span>
  );
}
