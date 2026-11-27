import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowRight, KeyRound, LayoutGrid, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LegalFooterLinks } from "~/components/layout/LegalLayout";
import { Logo } from "~/components/layout/Logo";
import { LEGAL } from "~/lib/legal";
import { getUser } from "~/services/session.server";

export const meta: MetaFunction = () => [
  { title: "NazmulCodes Auth · One account for every NazmulCodes app" },
  {
    name: "description",
    content: `Secure single sign-on for ${LEGAL.connectedProducts.join(", ")} and other NazmulCodes apps.`,
  },
  { name: "robots", content: "index, follow" },
];

/** Public home page: explains the service (also what Google's brand review looks at). */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request).catch(() => null);
  return json({ signedIn: Boolean(user), firstName: user?.name?.split(" ")[0] ?? null });
}

const primaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white";
const secondaryBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-800 px-5 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-700 hover:bg-neutral-900";

export default function Index() {
  const { signedIn, firstName } = useLoaderData<typeof loader>();
  const products = LEGAL.connectedProducts;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="NazmulCodes Auth home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {signedIn ? (
              <Link to="/account/security" className="rounded-md px-3 py-1.5 text-neutral-200 hover:bg-neutral-900">
                Your account
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-3 py-1.5 text-neutral-400 hover:text-neutral-100">
                  Sign in
                </Link>
                <Link to="/register" className="hidden rounded-md bg-neutral-900 px-3 py-1.5 text-neutral-100 hover:bg-neutral-800 sm:inline-block">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 max-w-3xl rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-14 pt-14 sm:px-6 sm:pb-20 sm:pt-24">
            <img src="/brand-mark.svg" alt="" width={56} height={56} className="h-14 w-14" />
            <h1 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-neutral-50 sm:text-5xl sm:leading-tight">
              One account for every{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">NazmulCodes</span> app
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              NazmulCodes Auth is the secure sign-in service for {products.join(", ")} and other apps built by
              NazmulCodes. Sign in once with Google or your email, protect your account with two-factor authentication,
              and choose which apps stay connected.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {signedIn ? (
                <Link to="/account/security" className={primaryBtn}>
                  {firstName ? `Continue as ${firstName}` : "Go to your account"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <>
                  <Link to="/register" className={primaryBtn}>
                    Create your account
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link to="/login" className={secondaryBtn}>
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="border-t border-neutral-900">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 id="features" className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              What it does
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feature icon={<LayoutGrid className="h-5 w-5" />} title="Single sign-on">
                Use the same account in every NazmulCodes app. No new password for each one.
              </Feature>
              <Feature icon={<UserRoundCheck className="h-5 w-5" />} title="Sign in with Google">
                Continue with your Google account, or use an email and password.
              </Feature>
              <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Two-factor authentication">
                Add an authenticator app and one-time backup codes for extra protection.
              </Feature>
              <Feature icon={<KeyRound className="h-5 w-5" />} title="You stay in control">
                See which apps are connected to your account and disconnect any of them at any time.
              </Feature>
            </div>
          </div>
        </section>

        {/* Data use */}
        <section aria-labelledby="data" className="border-t border-neutral-900">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
            <div>
              <h2 id="data" className="text-xl font-semibold tracking-tight text-neutral-100">
                How we use your Google account
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                When you choose <strong className="font-medium text-neutral-200">Continue with Google</strong>, we
                receive only your name, email address and profile photo. We use them to create your account and sign
                you in, and we never see your Google password or any other Google data. Details are in our{" "}
                <Link to="/privacy" className="text-neutral-200 underline underline-offset-4 hover:text-white">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-100">Apps that use NazmulCodes Auth</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {products.map((p) => (
                  <li key={p} className="rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-sm text-neutral-300">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {LEGAL.operator} ·{" "}
            <a href="https://www.nazmulcodes.org" className="hover:text-neutral-300">
              nazmulcodes.org
            </a>{" "}
            ·{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-neutral-300">
              {LEGAL.contactEmail}
            </a>
          </p>
          <LegalFooterLinks className="justify-start" />
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-800 bg-neutral-950 text-emerald-400" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-neutral-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}
