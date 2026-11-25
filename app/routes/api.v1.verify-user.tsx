import { json, type ActionFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { apiError, methodNotAllowed } from "~/lib/http.server";
import { authenticateClientApp, verifyUserForApp } from "~/services/oauth-provider.server";

/**
 * POST /api/v1/verify-user
 * Authorization: Bearer nc_live_…
 * Body: { userId: string }
 * → 200 { valid: true, user } | { valid: false }
 *
 * `valid` is true only if the user is ACTIVE *and* still connected to the
 * calling app (users can disconnect apps from /account/security).
 */
const Body = z.object({ userId: z.string().min(1).max(64) });

export const loader = () => methodNotAllowed();

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return methodNotAllowed();

  const auth = await authenticateClientApp(request);
  if (!auth.ok) return auth.response;

  const type = request.headers.get("content-type") ?? "";
  const raw = type.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError(400, "invalid_request", "Body must include `userId`.", auth.corsHeaders);

  const result = await verifyUserForApp(auth.app, parsed.data.userId);
  return json(result, { headers: { "Cache-Control": "no-store", ...auth.corsHeaders } });
}
