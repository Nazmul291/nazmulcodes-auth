import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { Toaster } from "~/components/ui";
import { useToasts } from "~/hooks/useToasts";
// Roboto Medium, self-hosted: Google's branding rules require it for the "Continue with Google" button.
import robotoMedium from "@fontsource/roboto/latin-500.css?url";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: robotoMedium },
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export const meta: MetaFunction = () => [
  { title: "NazmulCodes Auth" },
  { name: "description", content: "Single sign-on for the NazmulCodes ecosystem." },
  { name: "robots", content: "noindex, nofollow" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0a" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { toasts, dismiss } = useToasts();
  return (
    <>
      <Outlet />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? typeof error.data === "string"
      ? error.data
      : (error.data as { message?: string } | null)?.message ?? error.statusText
    : "Something went wrong.";
  if (!isRouteErrorResponse(error)) console.error(error);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3 text-center">
        <p className="font-mono text-sm text-neutral-500">{status}</p>
        <h1 className="text-lg font-semibold text-neutral-100">{message}</h1>
        <Link to="/" className="inline-block text-sm text-neutral-400 underline-offset-4 hover:text-neutral-100 hover:underline">
          Back to safety
        </Link>
      </div>
    </div>
  );
}
