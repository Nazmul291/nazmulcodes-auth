import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ShieldAlert } from "lucide-react";
import { AuthLayout } from "~/components/layout/AppShell";
import { audit } from "~/services/audit.server";
import { buildRedirect, issueAuthorizationCode, validateAuthorizeRequest } from "~/services/oauth-provider.server";
import { getUser } from "~/services/session.server";

export const meta: MetaFunction = () => [{ title: "Authorize · NazmulCodes" }];

/**
 * GET /authorize?client_id=veltrix&redirect_uri=…&state=…[&response_type=code]
 *
 * 1. Validate client + exact redirect_uri (errors render here, never redirect).
 * 2. No fully-authenticated session (incl. 2FA)?  → /login?returnTo=<this URL>
 * 3. Issue a single-use 60s code → 302 redirect_uri?code=…&state=…
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const v = await validateAuthorizeRequest(url);
  if (!v.ok) return json({ error: v.error, description: v.description }, { status: 400 });

  const user = await getUser(request); // null unless 2FA (when enabled) was passed
  if (!user) throw redirect(`/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);

  const code = await issueAuthorizationCode(user.id, v.app.id, v.redirectUri);
  void audit({
    actorType: "USER",
    actorId: user.id,
    action: "sso.authorize.code_issued",
    request,
    metadata: { clientAppId: v.app.id, slug: v.app.slug },
  });
  return redirect(buildRedirect(v.redirectUri, { code, state: v.state }), {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export default function AuthorizeErrorRoute() {
  const { error, description } = useLoaderData<typeof loader>();
  return (
    <AuthLayout title="Can't sign you in" subtitle="The app that sent you here is misconfigured.">
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 text-neutral-300">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
          <div>
            <p>{description}</p>
            <p className="mt-1 font-mono text-xs text-neutral-600">error={error}</p>
          </div>
        </div>
        <Link to="/" className="block text-center text-neutral-400 hover:text-neutral-100">
          Go to your NazmulCodes account
        </Link>
      </div>
    </AuthLayout>
  );
}
