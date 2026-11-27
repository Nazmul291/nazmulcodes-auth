/**
 * Code shown on /admin/docs. Kept in one place so the examples stay in sync
 * with the real API (routes/authorize.tsx, routes/api.v1.*.tsx) and the SDK.
 * `base` is this deployment's origin, e.g. https://auth.nazmulcodes.org.
 */

export const envSnippet = (base: string) => `# Client app's server-side environment (never expose to the browser)
NAZMULCODES_AUTH_URL=${base}
NAZMULCODES_AUTH_API_KEY=nc_live_…            # shown once in /admin/apps
NAZMULCODES_AUTH_REDIRECT_URI=https://veltrix.app/auth/callback   # must match a registered callback URL exactly
NAZMULCODES_AUTH_CLIENT_ID=veltrix            # optional: the app's slug (otherwise resolved from the key)
SESSION_SECRET=…                              # for the app's own session cookie`;

export const remixAuthServer = () => `// app/lib/auth.server.ts — the client app's server-only auth helpers
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { NazmulCodesAuthClient } from "./nazmulcodes-auth.server"; // the downloaded SDK

export const nc = new NazmulCodesAuthClient({
  authBaseUrl: process.env.NAZMULCODES_AUTH_URL!,
  apiKey: process.env.NAZMULCODES_AUTH_API_KEY!,
  redirectUri: process.env.NAZMULCODES_AUTH_REDIRECT_URI!,
  clientId: process.env.NAZMULCODES_AUTH_CLIENT_ID, // optional
});

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    sameSite: "lax", // must be "lax" (not "strict") so the cookie survives the redirect back from auth
    secure: process.env.NODE_ENV === "production",
    path: "/",
    secrets: [process.env.SESSION_SECRET!],
    maxAge: 60 * 60 * 24 * 14,
  },
});

const VERIFY_EVERY_MS = 15 * 60 * 1000; // re-check the central account every 15 min

/**
 * Use in every protected loader/action:
 *   const { userId, headers } = await requireUser(request);
 *   return json(data, { headers }); // headers persists the "verifiedAt" timestamp
 */
export async function requireUser(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId") as string | undefined;
  const centralUserId = session.get("centralUserId") as string | undefined;
  if (!userId || !centralUserId) {
    const returnTo = new URL(request.url).pathname;
    throw redirect(\`/auth/login?returnTo=\${encodeURIComponent(returnTo)}\`);
  }

  // Periodically confirm the user is still active and still connected to this app
  // (suspended in NazmulCodes Auth, or disconnected by the user → signed out here).
  const headers = new Headers();
  const lastCheck = Number(session.get("verifiedAt") ?? 0);
  if (Date.now() - lastCheck > VERIFY_EVERY_MS) {
    const { valid } = await nc.verifyUserStatus(centralUserId);
    if (!valid) {
      throw redirect("/", { headers: { "Set-Cookie": await sessionStorage.destroySession(session) } });
    }
    session.set("verifiedAt", Date.now());
    headers.set("Set-Cookie", await sessionStorage.commitSession(session));
  }
  return { userId, centralUserId, headers };
}`;

export const remixLoginRoute = () => `// app/routes/auth.login.tsx — sends the browser to NazmulCodes Auth
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { NazmulCodesAuthClient } from "~/lib/nazmulcodes-auth.server";
import { nc, sessionStorage } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await nc.resolveClientId(); // no-op if clientId was configured
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));

  const state = NazmulCodesAuthClient.generateState();
  session.flash("oauthState", state);
  // Only allow same-site paths as the post-login destination.
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/";
  session.flash("returnTo", returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");

  return redirect(nc.getAuthorizationUrl(state), {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}`;

export const remixCallbackRoute = () => `// app/routes/auth.callback.tsx — must match the registered callback URL
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { NazmulCodesAuthError } from "~/lib/nazmulcodes-auth.server";
import { nc, sessionStorage } from "~/lib/auth.server";
import { db } from "~/lib/db.server"; // the client app's own database

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const expected = session.get("oauthState") as string | undefined;
  const returnTo = (session.get("returnTo") as string | undefined) ?? "/";

  // 1. CSRF check: the state must be the one this browser started with.
  if (!code || !state || !expected || state !== expected) {
    throw redirect("/auth/login"); // start over
  }

  // 2. Exchange the single-use code (valid 60 s) for the verified user.
  let user;
  try {
    user = await nc.exchangeCodeForUser(code);
  } catch (err) {
    if (err instanceof NazmulCodesAuthError && err.code === "invalid_grant") throw redirect("/auth/login");
    throw err;
  }

  // 3. Upsert the local user by the stable central id (never by email alone).
  const local = await db.user.upsert({
    where: { centralUserId: user.id },
    create: { centralUserId: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    update: { email: user.email, name: user.name, avatarUrl: user.avatarUrl },
  });

  // 4. Start the app's own session.
  session.set("userId", local.id);
  session.set("centralUserId", user.id);
  session.set("verifiedAt", Date.now());
  return redirect(returnTo, { headers: { "Set-Cookie": await sessionStorage.commitSession(session) } });
}`;

export const remixLogoutRoute = () => `// app/routes/auth.logout.tsx — signs out of THIS app only
import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { sessionStorage } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/", { headers: { "Set-Cookie": await sessionStorage.destroySession(session) } });
}`;

export const prismaUserModel = () => `// Client app's Prisma schema — link local users to the central account
model User {
  id            String   @id @default(cuid())
  centralUserId String   @unique   // user.id from NazmulCodes Auth
  email         String
  name          String?
  avatarUrl     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}`;

export const curlAuthorize = (base: string) => `# 1. Send the browser here (GET, full-page redirect)
${base}/authorize?response_type=code&client_id=veltrix&redirect_uri=https%3A%2F%2Fveltrix.app%2Fauth%2Fcallback&state=<random 16+ chars>

# 2. After sign-in, the browser comes back to:
https://veltrix.app/auth/callback?code=<code>&state=<same state>`;

export const curlToken = (base: string) => `curl -X POST ${base}/api/v1/token \\
  -H "Authorization: Bearer $NAZMULCODES_AUTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"<code>","redirect_uri":"https://veltrix.app/auth/callback"}'

# 200
{ "user": { "id": "clx…", "email": "ada@example.com", "name": "Ada", "avatarUrl": null, "twoFactorEnabled": true } }`;

export const curlVerify = (base: string) => `curl -X POST ${base}/api/v1/verify-user \\
  -H "Authorization: Bearer $NAZMULCODES_AUTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"userId":"clx…"}'

# 200
{ "valid": true, "user": { "id": "clx…", "email": "…", "name": "…", "avatarUrl": null, "twoFactorEnabled": false } }
# or
{ "valid": false }`;

export const curlClientInfo = (base: string) => `curl -X POST ${base}/api/v1/client-info \\
  -H "Authorization: Bearer $NAZMULCODES_AUTH_API_KEY"

# 200
{ "clientId": "veltrix", "name": "Veltrix", "callbackUrls": ["https://veltrix.app/auth/callback"] }`;
