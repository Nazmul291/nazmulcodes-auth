import { useState, type FormEvent } from "react";
import { TotpCountdown } from "../security/TotpCountdown";
import { Alert, Button, CodeInput, Input } from "../ui";

export function TwoFactorChallengeForm({
  error,
  submitting,
  countdown,
  onSubmit,
}: {
  error: string | null;
  submitting: boolean;
  countdown: { secondsLeft: number; progress: number };
  onSubmit: (code: string) => void;
}) {
  const [useBackup, setUseBackup] = useState(false);
  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(String(new FormData(e.currentTarget).get("code") ?? ""));
  }
  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      {useBackup ? (
        <Input label="Backup code" name="code" autoComplete="off" spellCheck={false} placeholder="xxxxx-xxxxx" className="font-mono tracking-widest" autoFocus required />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Authenticator code</span>
            <TotpCountdown {...countdown} />
          </div>
          <CodeInput name="code" maxLength={6} placeholder="000000" autoFocus required />
        </div>
      )}
      <Button type="submit" block loading={submitting}>
        Verify
      </Button>
      <button type="button" onClick={() => setUseBackup((v) => !v)} className="w-full text-center text-xs text-neutral-500 hover:text-neutral-200">
        {useBackup ? "Use authenticator app instead" : "Lost your device? Use a backup code"}
      </button>
    </form>
  );
}
