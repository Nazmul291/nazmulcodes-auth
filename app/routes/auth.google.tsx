import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { safeReturnTo } from "~/lib/http.server";
import { createGoogleAuthorization } from "~/services/google-oauth.server";
import { withCookies } from "~/services/session.server";

/** GET /auth/google — starts Google OAuth 2.0 (state + PKCE S256). */
export async function loader({ request }: LoaderFunctionArgs) {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  const { url, setCookie } = createGoogleAuthorization(returnTo);
  return redirect(url, withCookies([setCookie]));
}
