import { json, type ActionFunctionArgs } from "@remix-run/node";
import { methodNotAllowed } from "~/lib/http.server";
import { authenticateClientApp } from "~/services/oauth-provider.server";

/**
 * POST /api/v1/client-info  (Authorization: Bearer nc_live_…)
 * → { clientId, name, callbackUrls }
 *
 * Lets a client app that only stores NAZMULCODES_AUTH_API_KEY discover its
 * public client_id (slug) for building /authorize URLs.
 */
export const loader = () => methodNotAllowed();

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return methodNotAllowed();
  const auth = await authenticateClientApp(request);
  if (!auth.ok) return auth.response;
  const { app } = auth;
  return json(
    { clientId: app.slug, name: app.name, callbackUrls: app.callbackUrls },
    { headers: { "Cache-Control": "no-store", ...auth.corsHeaders } },
  );
}
