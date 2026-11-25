import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5_000;

/** Security headers applied to every HTML document served by the IdP. */
function applySecurityHeaders(headers: Headers) {
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; img-src 'self' data: https://*.googleusercontent.com",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.APP_BASE_URL?.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  applySecurityHeaders(responseHeaders);
  const callback = isbot(request.headers.get("user-agent") ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [callback]() {
          shellRendered = true;
          const body = new PassThrough();
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      },
    );
    setTimeout(abort, ABORT_DELAY);
  });
}

/** Also harden data (loader/action) responses. */
export function handleDataRequest(response: Response) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
  return response;
}
