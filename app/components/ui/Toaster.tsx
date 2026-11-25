import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Toast } from "~/store/useAuthStore";
import { cn } from "./cn";

const icon = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
  info: <Info className="h-4 w-4 text-neutral-400" />,
};

export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:w-96">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200 shadow-xl",
          )}
        >
          <span className="mt-0.5">{icon[t.tone]}</span>
          <p className="flex-1">{t.message}</p>
          <button type="button" onClick={() => onDismiss(t.id)} className="text-neutral-500 hover:text-neutral-200" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
