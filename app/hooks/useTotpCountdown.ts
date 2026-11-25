import { useEffect, useState } from "react";

/** Seconds left in the current 30-second TOTP window (pure clock state, no I/O). */
export function useTotpCountdown(step = 30): { secondsLeft: number; progress: number } {
  const compute = () => step - (Math.floor(Date.now() / 1000) % step);
  const [secondsLeft, setSecondsLeft] = useState(step);

  useEffect(() => {
    setSecondsLeft(compute());
    const id = window.setInterval(() => setSecondsLeft(compute()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return { secondsLeft, progress: secondsLeft / step };
}
