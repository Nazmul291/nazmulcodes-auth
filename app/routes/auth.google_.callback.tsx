// File is `auth.google_.callback.tsx` so /auth/google/callback is not nested
// under the /auth/google route module.
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { audit } from "~/services/audit.server";
import { clearGoogleOAuthCookie, GoogleOAuthError, handleGoogleCallback } from "~/services/google-oauth.server";
import { completeFirstFactor, withCookies } from "~/services/session.server";
import { upsertGoogleUser } from "~/services/user.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const fail = (code: string) => redirect(`/login?error=${code}`, withCookies([clearGoogleOAuthCookie()]));

  let result: Awaited<ReturnType<typeof handleGoogleCallback>>;
  try {
    result = await handleGoogleCallback(request);
  } catch (err) {
    if (!(err instanceof GoogleOAuthError)) console.error("[google-oauth]", err);
    void audit({ actorType: "ANONYMOUS", action: "user.login.google.failed", success: false, request });
    return fail("google");
  }

  let user;
  try {
    user = await upsertGoogleUser(result.profile, request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return fail(msg.includes("different Google") ? "google_conflict" : "google_unverified");
  }
  if (user.status !== "ACTIVE") return fail("suspended");

  void audit({ actorType: "USER", actorId: user.id, action: "user.login.google.first_factor", request });
  const { location, cookies } = await completeFirstFactor(user, result.returnTo, "google");
  return redirect(location, withCookies([...cookies, clearGoogleOAuthCookie()]));
}
