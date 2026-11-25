import type { FormEvent } from "react";
import type { ClientAppFormValues } from "~/hooks/useClientApps";
import { Button, Input, Textarea } from "../ui";

export interface ClientAppFormDefaults {
  name?: string;
  slug?: string;
  description?: string | null;
  allowedOrigins?: string[];
  callbackUrls?: string[];
}

/** Used for both "create" and "edit". Uncontrolled; emits plain values. */
export function CreateAppForm({
  defaults = {},
  fieldErrors,
  submitting,
  submitLabel = "Create app",
  onSubmit,
  onCancel,
  slugLocked = false,
}: {
  defaults?: ClientAppFormDefaults;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (values: ClientAppFormValues) => void;
  onCancel?: () => void;
  slugLocked?: boolean;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    onSubmit({
      name: get("name"),
      slug: get("slug"),
      description: get("description"),
      allowedOrigins: get("allowedOrigins"),
      callbackUrls: get("callbackUrls"),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="App name" name="name" required defaultValue={defaults.name} placeholder="Veltrix" error={fieldErrors.name} />
        <Input
          label="Slug (client_id)"
          name="slug"
          required
          defaultValue={defaults.slug}
          readOnly={slugLocked}
          placeholder="veltrix"
          className="font-mono"
          error={fieldErrors.slug}
          hint={slugLocked ? "client_id cannot be changed." : "Lowercase, used as client_id."}
        />
      </div>
      <Input label="Description" name="description" defaultValue={defaults.description ?? ""} placeholder="Optional" error={fieldErrors.description} />
      <Textarea
        label="Callback URLs"
        name="callbackUrls"
        defaultValue={defaults.callbackUrls?.join("\n")}
        placeholder={"https://veltrix.app/auth/callback\nhttp://localhost:3000/auth/callback"}
        hint="One per line. redirect_uri must match exactly."
        error={fieldErrors.callbackUrls ?? fieldErrors["callbackUrls.0"]}
      />
      <Textarea
        label="Allowed origins"
        name="allowedOrigins"
        defaultValue={defaults.allowedOrigins?.join("\n")}
        placeholder="https://veltrix.app"
        hint="Browser origins permitted to call the API. Leave empty for server-to-server only."
        error={fieldErrors.allowedOrigins ?? fieldErrors["allowedOrigins.0"]}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
