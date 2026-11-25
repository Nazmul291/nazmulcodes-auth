import { json, redirect, redirectDocument, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Divider, GoogleButton } from "~/components/auth/GoogleButton";
import { LoginForm } from "~/components/auth/LoginForm";
import { AuthLayout } from "~/components/layout/AppShell";
import { Alert } from "~/components/ui";
import { useLogin } from "~/hooks/useUserAuth";
import type { UserAuthActionData } from "~/lib/action-types";
import { assertSameOrigin, getClientIp, safeReturnTo } from "~/lib/http.server";
import { fieldErrors, loginSchema } from "~/lib/validation";
import { audit } from "~/services/audit.server";
import { rateLimit, resetRateLimit } from "~/services/rate-limit.server";
import { completeFirstFactor, getUser, withCookies } from "~/services/session.server";
import { verifyPasswordLogin } from "~/services/user.server";

export const meta: MetaFunction = () => [{ title: "Sign in · NazmulCodes" }];

/** Error codes only — never reflect arbitrary query text into the page. */
const ERRORS: Record<string, string> = {
  google: "Google sign-in failed. Please try again.",
  google_unverified: "Your Google email address is not verified.",
  google_conflict: "This email is linked to a different Google account.",
  suspended: "This account has been suspended.",
  expired: "Your sign-in session expired. Please start again.",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (await getUser(request)) throw redirect(returnTo);
  const code = url.searchParams.get("error");
  return json({ returnTo, notice: code ? ERRORS[code] ?? null : null });
}

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const parsed = loginSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return json<UserAuthActionData>({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const returnTo = safeReturnTo(parsed.data.returnTo);

  const ip = getClientIp(request) ?? "unknown";
  const byIp = rateLimit(`login:ip:${ip}`, 30, 15 * 60);
  const byEmail = rateLimit(`login:email:${email}`, 10, 15 * 60);
  if (!byIp.ok || !byEmail.ok) {
    const minutes = Math.ceil(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds) / 60);
    return json<UserAuthActionData>({ ok: false, error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` }, { status: 429 });
  }

  const user = await verifyPasswordLogin(email, password);
  if (!user) {
    void audit({ actorType: "ANONYMOUS", action: "user.login.password.failed", success: false, request, metadata: { email } });
    return json<UserAuthActionData>({ ok: false, error: "Incorrect email or password." }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    return json<UserAuthActionData>({ ok: false, error: ERRORS.suspended! }, { status: 403 });
  }

  resetRateLimit(`login:email:${email}`);
  void audit({ actorType: "USER", actorId: user.id, action: "user.login.password.first_factor", request });
  const { location, cookies } = await completeFirstFactor(user, returnTo, "password");
  // Full document redirect so a follow-up /authorize can redirect off-site cleanly.
  return redirectDocument(location, withCookies(cookies));
}

export default function LoginRoute() {
  const { returnTo, notice } = useLoaderData<typeof loader>();
  const { login, isSubmitting, error, fieldErrors } = useLogin(returnTo);

  return (
    <AuthLayout
      title="Sign in"
      subtitle="One account for Veltrix, Stockly, Badgify, Kilo and more."
      footer={
        <>
          New here?{" "}
          <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="text-neutral-200 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {notice ? <Alert>{notice}</Alert> : null}
        <GoogleButton returnTo={returnTo} />
        <Divider />
        <LoginForm error={error} fieldErrors={fieldErrors} submitting={isSubmitting} onSubmit={login} />
      </div>
    </AuthLayout>
  );
}
