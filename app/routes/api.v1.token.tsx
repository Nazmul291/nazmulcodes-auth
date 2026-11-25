import { json, type ActionFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { apiError, methodNotAllowed } from "~/lib/http.server";
import { audit } from "~/services/audit.server";
import { authenticateClientApp, exchangeAuthorizationCode } from "~/services/oauth-provider.server";

/**
 * POST /api/v1/token
 * Authorization: Bearer nc_live_…
 * Body (JSON or form): { code: string, redirect_uri?: string }
 * → 200 { user: { id, email, name, avatarUrl, twoFactorEnabled } }
 */
const Body = z.object({
  code: z.string().min(16).max(256),
  redirect_uri: z.string().url().max(2048).optional(),
});

export const loader = () => methodNotAllowed();

async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return request.json().catch(() => null);
  return Object.fromEntries(await request.formData().catch(() => new FormData()));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return methodNotAllowed();

  const auth = await authenticateClientApp(request);
  if (!auth.ok) return auth.response;
  const { app, corsHeaders } = auth;

  const parsed = Body.safeParse(await readBody(request));
  if (!parsed.success) return apiError(400, "invalid_request", "Body must include a valid `code`.", corsHeaders);

  const result = await exchangeAuthorizationCode(app, parsed.data.code, parsed.data.redirect_uri ?? null);
  void audit({
    actorType: "CLIENT_APP",
    actorId: app.id,
    action: result.ok ? "sso.token.exchanged" : "sso.token.failed",
    success: result.ok,
    request,
    metadata: result.ok ? { userId: result.user.id } : { error: result.error },
  });
  if (!result.ok) return apiError(result.status, result.error, result.message, corsHeaders);

  return json({ user: result.user }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...corsHeaders } });
}
