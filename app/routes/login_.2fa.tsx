// File is `login_.2fa.tsx` (trailing underscore) so /login/2fa is NOT nested
// inside the /login layout in Remix flat routes.
import { json, redirect, redirectDocument, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { TwoFactorChallengeForm } from "~/components/auth/TwoFactorChallengeForm";
import { AuthLayout } from "~/components/layout/AppShell";
import { useTotpCountdown } from "~/hooks/useTotpCountdown";
import { useTwoFactorChallenge } from "~/hooks/useUserAuth";
import type { UserAuthActionData } from "~/lib/action-types";
import { db } from "~/lib/db.server";
import { assertSameOrigin } from "~/lib/http.server";
import { secondFactorSchema } from "~/lib/validation";
import { audit } from "~/services/audit.server";
import { rateLimit, resetRateLimit } from "~/services/rate-limit.server";
import { commitUserSession, destroyPending2fa, readPending2fa, withCookies } from "~/services/session.server";
import { verifySecondFactor } from "~/services/totp.server";

export const meta: MetaFunction = () => [{ title: "Two-factor verification · NazmulCodes" }];

const MAX_2FA_ATTEMPTS = 5;

async function loadPendingUser(request: Request) {
  const pending = readPending2fa(request);
  if (!pending) return null;
  const user = await db.centralUser.findUnique({ where: { id: pending.uid } });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== pending.sv || !user.twoFactorEnabled) return null;
  return { pending, user };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await loadPendingUser(request);
  if (!ctx) throw redirect("/login?error=expired", withCookies([destroyPending2fa()]));
  const [local, domain] = ctx.user.email.split("@");
  return json({ maskedEmail: `${local!.slice(0, 2)}${"•".repeat(Math.max(1, local!.length - 2))}@${domain}` });
}

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const ctx = await loadPendingUser(request);
  if (!ctx) return redirectDocument("/login?error=expired", withCookies([destroyPending2fa()]));
  const { pending, user } = ctx;

  // Per-user limit so a stolen first factor can't brute-force 10^6 codes.
  const limit = await rateLimit(`2fa:${user.id}`, MAX_2FA_ATTEMPTS, 15 * 60);
  if (!limit.ok) {
    void audit({ actorType: "USER", actorId: user.id, action: "user.login.2fa.rate_limited", success: false, request });
    return redirectDocument("/login?error=expired", withCookies([destroyPending2fa()]));
  }

  const parsed = secondFactorSchema.safeParse((await request.formData()).get("code"));
  if (!parsed.success) return json<UserAuthActionData>({ ok: false, error: parsed.error.issues[0]!.message }, { status: 400 });

  const result = await verifySecondFactor(user.id, parsed.data);
  if (!result.ok) {
    void audit({ actorType: "USER", actorId: user.id, action: "user.login.2fa.failed", success: false, request });
    return json<UserAuthActionData>(
      { ok: false, error: `Invalid or already-used code. ${limit.remaining} attempt${limit.remaining === 1 ? "" : "s"} left.` },
      { status: 401 },
    );
  }

  await resetRateLimit(`2fa:${user.id}`);
  await db.centralUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  void audit({ actorType: "USER", actorId: user.id, action: `user.login.2fa.success.${result.method}`, request, metadata: { firstFactor: pending.method } });
  return redirectDocument(pending.returnTo, withCookies([commitUserSession(user, true), destroyPending2fa()]));
}

export default function TwoFactorChallengeRoute() {
  const { maskedEmail } = useLoaderData<typeof loader>();
  const { verify, isSubmitting, error } = useTwoFactorChallenge();
  const countdown = useTotpCountdown();
  return (
    <AuthLayout
      title="Two-factor verification"
      subtitle={<>Signing in as <span className="text-neutral-300">{maskedEmail}</span></>}
      footer={
        <Link to="/login" className="hover:text-neutral-200">
          Cancel and start over
        </Link>
      }
    >
      <TwoFactorChallengeForm error={error} submitting={isSubmitting} countdown={countdown} onSubmit={verify} />
    </AuthLayout>
  );
}
