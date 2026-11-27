import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Check, Copy, Download } from "lucide-react";
import type { ReactNode } from "react";
import { AdminNav } from "~/components/layout/AdminNav";
import { AppShell } from "~/components/layout/AppShell";
import { UserChip } from "~/components/layout/UserChip";
import { useCopy } from "~/hooks/useCopy";
import { useLogout } from "~/hooks/useUserAuth";
import { appOrigin } from "~/lib/env.server";
import {
  curlAuthorize,
  curlClientInfo,
  curlToken,
  curlVerify,
  envSnippet,
  prismaUserModel,
  remixAuthServer,
  remixCallbackRoute,
  remixLoginRoute,
  remixLogoutRoute,
} from "~/lib/integration-snippets";
import { requireSuperAdmin } from "~/services/super-admin.server";

export const meta: MetaFunction = () => [
  { title: "Integration docs · NazmulCodes Root" },
  { name: "robots", content: "noindex, nofollow" },
];

/** Root Super Admin only — same guard as /admin/apps. */
export function loader({ request }: LoaderFunctionArgs) {
  const admin = requireSuperAdmin(request);
  return json(
    { adminEmail: admin.email, base: appOrigin },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

const SECTIONS = [
  { id: "how-it-works", title: "How it works" },
  { id: "register", title: "1. Register the app" },
  { id: "env", title: "2. Store the API key" },
  { id: "sdk", title: "3. Add the SDK" },
  { id: "remix", title: "4. Remix integration" },
  { id: "other", title: "Other frameworks (HTTP API)" },
  { id: "errors", title: "Errors" },
  { id: "security", title: "Security checklist" },
  { id: "operations", title: "Rotate, suspend, revoke" },
  { id: "troubleshooting", title: "Troubleshooting" },
] as const;

export default function AdminDocsRoute() {
  const { adminEmail, base } = useLoaderData<typeof loader>();
  const { logout, isLoggingOut } = useLogout();

  return (
    <AppShell
      logoSuffix="Root"
      nav={<AdminNav />}
      actions={<UserChip label="Root" sublabel={adminEmail} onLogout={() => logout("admin")} loggingOut={isLoggingOut} />}
    >
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <aside className="mb-8 lg:mb-0">
          <nav aria-label="On this page" className="lg:sticky lg:top-32">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">On this page</p>
            <ol className="space-y-1.5 border-l border-neutral-800 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-0.5 pl-3 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-100"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl space-y-12">
          <header className="space-y-2">
            <p className="font-mono text-xs text-neutral-500">Internal · Root Super Admin only</p>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Integrating an app with NazmulCodes Auth</h1>
            <p className="text-sm leading-relaxed text-neutral-400">
              How to add &quot;Sign in with NazmulCodes&quot; to Veltrix, Stockly, Badgify, Kilo or any new app. Base URL of
              this deployment: <code className="font-mono text-neutral-200">{base}</code>
            </p>
          </header>

          <Section id="how-it-works" title="How it works">
            <p>
              The standard OAuth 2.0 authorization-code flow, simplified. Your app never sees passwords or 2FA codes; it
              only receives a verified user.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Your app redirects the browser to <Code>/authorize</Code> with its <Code>client_id</Code>,{" "}
                <Code>redirect_uri</Code> and a random <Code>state</Code>.
              </li>
              <li>The user signs in here (password or Google, plus 2FA if enabled). Already signed in → instant.</li>
              <li>
                The browser returns to your <Code>redirect_uri</Code> with <Code>?code=…&amp;state=…</Code>. The code is
                single-use and expires after <strong>60 seconds</strong>.
              </li>
              <li>
                Your <strong>server</strong> exchanges the code at <Code>POST /api/v1/token</Code> using the app&apos;s API key
                and gets <Code>{"{ id, email, name, avatarUrl, twoFactorEnabled }"}</Code>.
              </li>
              <li>Your app upserts its local user by <Code>id</Code> (the stable central user id) and starts its own session.</li>
              <li>
                Every ~15 minutes (or before sensitive actions) your server calls <Code>POST /api/v1/verify-user</Code> to
                confirm the user is still active and still connected to your app.
              </li>
            </ol>
          </Section>

          <Section id="register" title="1. Register the app">
            <p>
              In <Link to="/admin/apps" className="text-neutral-200 underline underline-offset-4">Client apps</Link> → <strong>New app</strong>:
            </p>
            <Table
              head={["Field", "What to enter"]}
              rows={[
                ["Name", "Shown to users, e.g. Veltrix."],
                ["Slug", <>Becomes the public <Code>client_id</Code>, e.g. <Code>veltrix</Code>. Cannot be changed later.</>],
                [
                  "Callback URLs",
                  <>
                    One per line, matched <strong>exactly</strong> (scheme, host, port, path). Add both production and local, e.g.{" "}
                    <Code>https://veltrix.app/auth/callback</Code> and <Code>http://localhost:3000/auth/callback</Code>.
                  </>,
                ],
                [
                  "Allowed origins",
                  <>
                    Leave <strong>empty</strong>. Only needed if a browser calls the API directly, which you should not do: the API
                    key must stay on the server.
                  </>,
                ],
              ]}
            />
            <p>
              After saving, the <Code>nc_live_…</Code> key is shown <strong>once</strong>. Only a hash is stored, so if it is lost,
              rotate it.
            </p>
          </Section>

          <Section id="env" title="2. Store the API key">
            <p>Keep it server-side only: an environment variable, or the app&apos;s encrypted Super Admin settings.</p>
            <CodeBlock code={envSnippet(base)} />
          </Section>

          <Section id="sdk" title="3. Add the SDK">
            <p>
              A single zero-dependency TypeScript file. Save it in the client app as{" "}
              <Code>app/lib/nazmulcodes-auth.server.ts</Code> (the <Code>.server</Code> suffix keeps it out of browser bundles).
            </p>
            <a
              href="/admin/docs/sdk"
              download="nazmulcodes-auth.server.ts"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-100 px-4 text-sm font-medium text-neutral-950 hover:bg-white"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download nazmulcodes-auth.server.ts
            </a>
            <Table
              head={["SDK method", "Does"]}
              rows={[
                [<Code key="1">NazmulCodesAuthClient.generateState()</Code>, "Random CSRF state for the login redirect."],
                [<Code key="2">getAuthorizationUrl(state)</Code>, "Builds the /authorize URL."],
                [<Code key="3">exchangeCodeForUser(code)</Code>, "POST /api/v1/token → verified user."],
                [<Code key="4">verifyUserStatus(userId)</Code>, "POST /api/v1/verify-user → { valid, user? }."],
                [<Code key="5">resolveClientId()</Code>, "Looks up the client_id from the key (if not configured)."],
              ]}
            />
            <p>
              Errors throw <Code>NazmulCodesAuthError</Code> with <Code>status</Code> and <Code>code</Code> (see{" "}
              <a href="#errors" className="text-neutral-200 underline underline-offset-4">Errors</a>).
            </p>
          </Section>

          <Section id="remix" title="4. Remix integration">
            <p>A complete example. Adapt names to the app; the important parts are commented.</p>
            <CodeBlock code={remixAuthServer()} />
            <CodeBlock code={remixLoginRoute()} />
            <CodeBlock code={remixCallbackRoute()} />
            <CodeBlock code={remixLogoutRoute()} />
            <CodeBlock code={prismaUserModel()} />
            <Note>
              Signing out of the client app does not sign the user out of NazmulCodes Auth (that session lasts up to 14 days).
              The next &quot;Sign in&quot; is then instant, which is the point of SSO.
            </Note>
          </Section>

          <Section id="other" title="Other frameworks (HTTP API)">
            <p>
              Any backend (Next.js, Express, Laravel…) can use the API directly. All API calls are server-to-server{" "}
              <Code>POST</Code> requests with <Code>Authorization: Bearer nc_live_…</Code> and a JSON body.
            </p>
            <h3 className="pt-2 text-sm font-semibold text-neutral-200">GET /authorize</h3>
            <CodeBlock code={curlAuthorize(base)} />
            <h3 className="pt-2 text-sm font-semibold text-neutral-200">POST /api/v1/token</h3>
            <CodeBlock code={curlToken(base)} />
            <h3 className="pt-2 text-sm font-semibold text-neutral-200">POST /api/v1/verify-user</h3>
            <CodeBlock code={curlVerify(base)} />
            <h3 className="pt-2 text-sm font-semibold text-neutral-200">POST /api/v1/client-info</h3>
            <CodeBlock code={curlClientInfo(base)} />
          </Section>

          <Section id="errors" title="Errors">
            <p>API errors are JSON: <Code>{'{ "error": "<code>", "message": "…" }'}</Code>.</p>
            <Table
              head={["Status", "error", "Meaning"]}
              rows={[
                ["401", <Code key="a">invalid_client</Code>, "Missing, malformed or wrong API key (e.g. after rotation)."],
                ["403", <Code key="b">client_suspended</Code>, "The app is suspended in /admin/apps."],
                ["403", <Code key="c">origin_not_allowed</Code>, "A browser called the API from an origin not in Allowed origins."],
                ["400", <Code key="d">invalid_request</Code>, "Body is missing code / userId, or is malformed."],
                ["400", <Code key="e">invalid_grant</Code>, "Code is wrong, expired (60 s), already used, or redirect_uri does not match."],
                ["403", <Code key="f">access_denied</Code>, "The user's central account is suspended."],
              ]}
            />
            <p>
              <Code>/authorize</Code> never redirects back with an error. A bad <Code>client_id</Code>, unregistered{" "}
              <Code>redirect_uri</Code> or suspended app shows an error page here instead (protection against open redirects).
            </p>
          </Section>

          <Section id="security" title="Security checklist">
            <ul className="space-y-1.5">
              {[
                "The API key only exists on the server. Never in client code, URLs, logs or Git.",
                "Generate a fresh state for every login, store it in the app's session, and reject the callback if it does not match.",
                "Use sameSite: \"lax\" for the app's session cookie, otherwise the state is lost on the redirect back.",
                "Exchange the code immediately: it is valid for 60 seconds and only once.",
                "Identify users by the central user id, not by email (emails can change).",
                "Re-check verify-user periodically and sign the user out when valid is false.",
                "Register only exact callback URLs you control; remove localhost URLs you no longer use.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="operations" title="Rotate, suspend, revoke">
            <Table
              head={["Action", "Where", "Effect"]}
              rows={[
                ["Rotate API key", "Client apps → Rotate key", "Old key stops working immediately. Update the app's env and redeploy right away."],
                ["Suspend app", "Client apps → Suspend", "All API calls return 403 client_suspended (the SDK throws NazmulCodesAuthError) and /authorize shows an error page. Handle that error in the app, e.g. show a maintenance message."],
                ["User disconnects an app", "User's Account → Security", "verify-user returns valid: false for that app. Signing in again reconnects it."],
                ["Suspend a user", "Database (status = SUSPENDED)", "Token exchange returns access_denied; verify-user returns valid: false."],
              ]}
            />
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <Table
              head={["Symptom", "Fix"]}
              rows={[
                ["\"redirect_uri is not registered for this app\"", "The URL must match a callback URL character for character, including http/https, port and trailing slash."],
                ["\"Unknown client_id\"", "Use the app's slug (or let the SDK resolve it with resolveClientId())."],
                ["Callback says state mismatch / loops back to login", "The app's session cookie is not kept across the redirect: use sameSite \"lax\", the same domain, and commit the session in the login loader."],
                ["invalid_grant", "Code used twice (e.g. page refresh) or exchanged after 60 s. Start the login again."],
                ["invalid_client after deploy", "The key was rotated or copied wrongly. Rotate and update the env var."],
                ["Works locally, not in production", "Add the production callback URL in Client apps; check NAZMULCODES_AUTH_URL and REDIRECT_URI in the production env."],
              ]}
            />
          </Section>
        </article>
      </div>
    </AppShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 space-y-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-neutral-100">
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-neutral-400">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="break-words rounded bg-neutral-900 px-1 py-0.5 font-mono text-xs text-neutral-200">{children}</code>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">{children}</p>;
}

function CodeBlock({ code }: { code: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="relative rounded-lg border border-neutral-800 bg-neutral-950">
      <button
        type="button"
        onClick={() => copy(code)}
        className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 font-mono text-xs leading-relaxed text-neutral-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-neutral-900/60 text-xs uppercase tracking-wider text-neutral-500">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-neutral-400">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
