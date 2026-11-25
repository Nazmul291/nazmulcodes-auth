import { useEffect } from "react";
import { useAuthStore } from "~/store/useAuthStore";

/** Exposes toasts and auto-dismisses each after `ttlMs`. */
export function useToasts(ttlMs = 5000) {
  const toasts = useAuthStore((s) => s.toasts);
  const dismiss = useAuthStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), ttlMs));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismiss, ttlMs]);

  return { toasts, dismiss };
}
