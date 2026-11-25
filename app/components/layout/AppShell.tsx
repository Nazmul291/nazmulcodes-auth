import { Link } from "@remix-run/react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Authenticated page chrome: top bar + optional nav + content column. */
export function AppShell({
  nav,
  actions,
  logoSuffix,
  children,
}: {
  nav?: ReactNode;
  actions?: ReactNode;
  logoSuffix?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo suffix={logoSuffix} />
          </Link>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {nav ? (
          <div className="mx-auto w-full max-w-5xl overflow-x-auto px-4 sm:px-6">{nav}</div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

/** Centered single-card layout for login / register / 2FA / root-access. */
export function AuthLayout({ title, subtitle, children, footer, logoSuffix }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  logoSuffix?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo suffix={logoSuffix} />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-100">{title}</h1>
          {subtitle ? <p className="text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5 sm:p-6">{children}</div>
        {footer ? <div className="text-center text-sm text-neutral-500">{footer}</div> : null}
      </div>
    </div>
  );
}
