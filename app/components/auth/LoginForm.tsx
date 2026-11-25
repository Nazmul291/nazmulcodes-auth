import type { FormEvent } from "react";
import { Alert, Button, Input } from "../ui";

export function LoginForm({
  error,
  fieldErrors,
  submitting,
  onSubmit,
}: {
  error: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onSubmit: (values: { email: string; password: string }) => void;
}) {
  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") });
  }
  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required error={fieldErrors.password} />
      <Button type="submit" block loading={submitting}>
        Sign in
      </Button>
    </form>
  );
}
