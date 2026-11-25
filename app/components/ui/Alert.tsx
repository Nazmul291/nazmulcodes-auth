import { AlertTriangle, Info, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "error" | "info" | "locked";
const styles: Record<Tone, string> = {
  error: "border-red-900/60 bg-red-950/30 text-red-300",
  info: "border-neutral-800 bg-neutral-900/60 text-neutral-300",
  locked: "border-amber-900/60 bg-amber-950/30 text-amber-200",
};
const icons: Record<Tone, ReactNode> = {
  error: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0" />,
  locked: <Lock className="mt-0.5 h-4 w-4 shrink-0" />,
};

export function Alert({ tone = "error", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "info" ? "status" : "alert"} className={cn("flex gap-2.5 rounded-lg border p-3 text-sm", styles[tone])}>
      {icons[tone]}
      <div>{children}</div>
    </div>
  );
}
