import { json, redirect, redirectDocument, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { RootAccessForm } from "~/components/auth/RootAccessForm";
import { AuthLayout } from "~/components/layout/AppShell";
import { useRootLogin } from "~/hooks/useRootLogin";
import type { RootLoginActionData } from "~/lib/action-types";
import { assertSameOrigin } from "~/lib/http.server";
import { rootLoginSchema } from "~/lib/validation";
import { authenticateRootAdmin, getLockoutStatus, getSuperAdmin, MAX_ROOT_ATTEMPTS } from "~/services/super-admin.server";

export const meta: MetaFunction = () => [{ title: "Root access · NazmulCodes" }, { name: "robots", content: "noindex, nofollow" }];

/** Never touches PostgreSQL: works even when the database is wiped or down. */
export async function loader({ request }: LoaderFunctionArgs) {
  if (getSuperAdmin(request)) throw redirect("/admin/apps");
  const status = getLockoutStatus();
  return json(
    { locked: status.locked, remaining: status.remaining, max: MAX_ROOT_ATTEMPTS },
    { status: status.locked ? 423 : 200 },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  // Malformed input still counts as a failed attempt (handled inside authenticate).
  const parsed = rootLoginSchema.safeParse(Object.fromEntries(await request.formData()));
  const input = parsed.success ? parsed.data : { email: "", password: "", totp: "" };

  const result = await authenticateRootAdmin(request, input);
  switch (result.status) {
    case "ok":
      return redirectDocument("/admin/apps", { headers: { "Set-Cookie": result.setCookie } });
    case "locked":
      return json<RootLoginActionData>({ ok: false, error: result.message, locked: true, remaining: 0 }, { status: 423 });
    case "busy":
      return json<RootLoginActionData>({ ok: false, error: result.message }, { status: 429 });
    case "invalid":
      return json<RootLoginActionData>({ ok: false, error: result.message, remaining: result.remaining }, { status: 401 });
  }
}

export default function RootAccessRoute() {
  const initial = useLoaderData<typeof loader>();
  const { submit, isSubmitting, error, locked, remaining } = useRootLogin(initial);
  return (
    <AuthLayout logoSuffix="Root" title="Root Super Admin" subtitle="Environment-backed access. Independent of the database.">
      <RootAccessForm error={error} locked={locked} remaining={remaining} maxAttempts={initial.max} submitting={isSubmitting} onSubmit={submit} />
    </AuthLayout>
  );
}
