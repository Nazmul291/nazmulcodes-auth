import { redirect, redirectDocument, type ActionFunctionArgs } from "@remix-run/node";
import { assertSameOrigin } from "~/lib/http.server";
import { destroyPending2fa, destroyUserSession, withCookies } from "~/services/session.server";
import { destroySuperAdminSession } from "~/services/super-admin.server";

/** GET never logs out (prevents CSRF-by-image logouts). */
export const loader = () => redirect("/");

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const scope = String((await request.formData()).get("scope") ?? "all");
  const cookies: string[] = [];
  if (scope === "user" || scope === "all") cookies.push(destroyUserSession(), destroyPending2fa());
  if (scope === "admin" || scope === "all") cookies.push(destroySuperAdminSession());
  return redirectDocument(scope === "admin" ? "/root-access" : "/login", withCookies(cookies));
}
