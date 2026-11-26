import { json, redirect, redirectDocument, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Divider, GoogleButton } from "~/components/auth/GoogleButton";
import { RegisterForm } from "~/components/auth/RegisterForm";
import { AuthLayout } from "~/components/layout/AppShell";
import { useRegister } from "~/hooks/useUserAuth";
import type { UserAuthActionData } from "~/lib/action-types";
import { assertSameOrigin, getClientIp, safeReturnTo } from "~/lib/http.server";
import { fieldErrors, registerSchema } from "~/lib/validation";
import { audit } from "~/services/audit.server";
import { rateLimit } from "~/services/rate-limit.server";
import { completeFirstFactor, getUser, withCookies } from "~/services/session.server";
import { registerWithPassword } from "~/services/user.server";

export const meta: MetaFunction = () => [{ title: "Create account · NazmulCodes" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  if (await getUser(request)) throw redirect(returnTo);
  return json({ returnTo });
}

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const parsed = registerSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return json<UserAuthActionData>({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
  }
  const limit = await rateLimit(`register:ip:${getClientIp(request) ?? "unknown"}`, 10, 60 * 60);
  if (!limit.ok) return json<UserAuthActionData>({ ok: false, error: "Too many sign-ups from this network. Try later." }, { status: 429 });

  const result = await registerWithPassword(parsed.data);
  if (!result.ok) return json<UserAuthActionData>({ ok: false, error: result.error, fieldErrors: { email: result.error } }, { status: 409 });

  void audit({ actorType: "USER", actorId: result.user.id, action: "user.register.password", request });
  const { location, cookies } = await completeFirstFactor(result.user, safeReturnTo(parsed.data.returnTo), "password");
  return redirectDocument(location, withCookies(cookies));
}

export default function RegisterRoute() {
  const { returnTo } = useLoaderData<typeof loader>();
  const { register, isSubmitting, error, fieldErrors } = useRegister(returnTo);
  return (
    <AuthLayout
      title="Create your NazmulCodes account"
      subtitle="Use it across every app in the ecosystem."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-neutral-200 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton returnTo={returnTo} label="Sign up with Google" />
        <Divider />
        <RegisterForm error={error} fieldErrors={fieldErrors} submitting={isSubmitting} onSubmit={register} />
        <p className="text-center text-xs leading-relaxed text-neutral-500">
          By creating an account, you agree to our{" "}
          <Link to="/terms" className="text-neutral-300 underline-offset-4 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-neutral-300 underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthLayout>
  );
}
