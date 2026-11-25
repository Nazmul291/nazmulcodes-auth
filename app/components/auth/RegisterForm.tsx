import type { FormEvent } from "react";
import { Alert, Button, Input } from "../ui";

export function RegisterForm({
  error,
  fieldErrors,
  submitting,
  onSubmit,
}: {
  error: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onSubmit: (values: { name: string; email: string; password: string }) => void;
}) {
  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
  }
  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <Input label="Name" name="name" autoComplete="name" required error={fieldErrors.name} />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        error={fieldErrors.password}
        hint="At least 10 characters."
      />
      <Button type="submit" block loading={submitting}>
        Create account
      </Button>
    </form>
  );
}
