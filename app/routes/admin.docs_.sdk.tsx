import type { LoaderFunctionArgs } from "@remix-run/node";
import sdkSource from "../../sdk/nazmulcodes-auth.ts?raw";
import { requireSuperAdmin } from "~/services/super-admin.server";

/**
 * GET /admin/docs/sdk — downloads the client SDK (sdk/nazmulcodes-auth.ts).
 * Root Super Admin only. The file is bundled at build time with Vite's ?raw,
 * so it always matches the deployed API.
 */
export function loader({ request }: LoaderFunctionArgs) {
  requireSuperAdmin(request);
  return new Response(sdkSource, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nazmulcodes-auth.server.ts"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
