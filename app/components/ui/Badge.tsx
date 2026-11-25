import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-neutral-700 bg-neutral-800/60 text-neutral-300",
  success: "border-emerald-900/70 bg-emerald-950/50 text-emerald-300",
  warning: "border-amber-900/70 bg-amber-950/50 text-amber-300",
  danger: "border-red-900/70 bg-red-950/50 text-red-300",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
