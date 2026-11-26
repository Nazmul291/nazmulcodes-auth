import { Link, NavLink } from "@remix-run/react";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_LINKS } from "~/lib/legal";
import { cn } from "~/components/ui/cn";
import { Logo } from "./Logo";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Long-form document page for /privacy and /terms. Mobile-first: contents sit above the text, then move to a sticky sidebar on large screens. */
export function LegalLayout({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Legal" className="flex items-center gap-1 text-sm">
            {LEGAL_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1.5 text-neutral-500 transition-colors hover:text-neutral-100",
                    isActive && "bg-neutral-900 text-neutral-100",
                  )
                }
              >
                <span className="sm:hidden">{l.label.split(" ")[0]}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="mb-10 lg:mb-0">
          <nav aria-label="On this page" className="lg:sticky lg:top-24">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">On this page</p>
            <ol className="space-y-1.5 border-l border-neutral-800 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-0.5 pl-3 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-100"
                  >
                    <span className="mr-1.5 font-mono text-xs text-neutral-600">{i + 1}.</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="max-w-2xl">
          <p className="font-mono text-xs text-neutral-500">Last updated {LEGAL.lastUpdated}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl">{title}</h1>
          <div className="legal-prose mt-5">{intro}</div>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24" aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="text-base font-semibold text-neutral-100 sm:text-lg">
                  <span className="mr-2 font-mono text-sm text-neutral-600">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="legal-prose mt-3">{s.body}</div>
              </section>
            ))}
          </div>

          <footer className="mt-14 border-t border-neutral-900 pt-6 text-sm text-neutral-500">
            Questions? Email{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-neutral-200 underline-offset-4 hover:underline">
              {LEGAL.contactEmail}
            </a>
            .
          </footer>
        </article>
      </main>
    </div>
  );
}

/** Small "Privacy · Terms" row for the bottom of auth pages. */
export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex justify-center gap-4 text-xs text-neutral-600", className)}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="transition-colors hover:text-neutral-300">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
