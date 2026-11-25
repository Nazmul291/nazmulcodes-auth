import type { FormEvent } from "react";
import { Alert, Button, CodeInput, Input } from "../ui";

export function RootAccessForm({
  error,
  locked,
  remaining,
  maxAttempts,
  submitting,
  onSubmit,
}: {
  error: string | null;
  locked: boolean;
  remaining: number;
  maxAttempts: number;
  submitting: boolean;
  onSubmit: (values: { email: string; password: string; totp: string }) => void;
}) {
  if (locked) {
    return (
      <Alert tone="locked">
        <p className="font-medium">Root access locked</p>
        <p className="mt-1 text-amber-200/80">
          {maxAttempts} failed attempts were recorded. This endpoint stays locked until the server process is restarted.
        </p>
      </Alert>
    );
  }
  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      totp: String(fd.get("totp") ?? ""),
    });
  }
  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <Input label="Root email" name="email" type="email" autoComplete="username" required />
      <Input label="Root password" name="password" type="password" autoComplete="current-password" required />
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-neutral-400">Authenticator code</span>
        <CodeInput name="totp" maxLength={6} placeholder="000000" required />
      </div>
      <Button type="submit" block loading={submitting}>
        Unlock admin
      </Button>
      <p className={remaining <= 3 ? "text-center text-xs text-amber-300" : "text-center text-xs text-neutral-600"}>
        {remaining} of {maxAttempts} attempts remaining before hard lockout
      </p>
    </form>
  );
}
