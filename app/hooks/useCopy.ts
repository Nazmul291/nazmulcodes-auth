import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "~/store/useAuthStore";

/** Clipboard helper with a transient "copied" flag. */
export function useCopy(resetMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  const pushToast = useAuthStore((s) => s.pushToast);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), resetMs);
      } catch {
        pushToast("error", "Clipboard unavailable — select and copy manually.");
      }
    },
    [pushToast, resetMs],
  );

  return { copied, copy };
}
