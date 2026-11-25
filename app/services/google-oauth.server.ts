import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "~/lib/env.server";
import { createSealedCookie } from "./cookie.server";
import { randomToken, safeEqual } from "./crypto.server";
import type { GoogleProfile } from "./user.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const googleRedirectUri = () => `${env.APP_BASE_URL}/auth/google/callback`;

interface GoogleOAuthState {
  state: string;
  verifier: string;
  returnTo: string;
}

/** 10-minute sealed cookie holding CSRF state + PKCE verifier. */
const oauthCookie = createSealedCookie<GoogleOAuthState>("nc_google", "cookie:google-oauth", 600);

export function createGoogleAuthorization(returnTo: string): { url: string; setCookie: string } {
  const state = randomToken(32);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  }).toString();

  return { url: url.toString(), setCookie: oauthCookie.commit({ state, verifier, returnTo }) };
}

export function clearGoogleOAuthCookie(): string {
  return oauthCookie.destroy();
}

const TokenResponse = z.object({ access_token: z.string(), token_type: z.string() });
const UserInfo = z.object({
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.literal("true"), z.literal("false")]).transform((v) => v === true || v === "true"),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export class GoogleOAuthError extends Error {}

/** Validates state, exchanges the code (with PKCE) and fetches the OIDC userinfo. */
export async function handleGoogleCallback(
  request: Request,
): Promise<{ profile: GoogleProfile; returnTo: string }> {
  const url = new URL(request.url);
  const saved = oauthCookie.read(request);
  if (url.searchParams.get("error")) throw new GoogleOAuthError("Google sign-in was cancelled.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || !safeEqual(state, saved.state)) {
    throw new GoogleOAuthError("Your sign-in session expired or was tampered with. Please try again.");
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new GoogleOAuthError("Google rejected the sign-in. Please try again.");
  const token = TokenResponse.parse(await tokenRes.json());

  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!infoRes.ok) throw new GoogleOAuthError("Could not read your Google profile.");
  const info = UserInfo.parse(await infoRes.json());
  if (!info.email_verified) throw new GoogleOAuthError("Your Google email address is not verified.");

  return {
    returnTo: saved.returnTo,
    profile: {
      sub: info.sub,
      email: info.email,
      emailVerified: info.email_verified,
      name: info.name ?? null,
      picture: info.picture ?? null,
    },
  };
}
