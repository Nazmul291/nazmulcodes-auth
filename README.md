# NazmulCodes Auth

Central Identity Provider & SSO for the NazmulCodes ecosystem (Veltrix, Stockly, Badgify, Kilo, …).
Remix (Vite, strict TS) · Prisma/PostgreSQL · Zustand · Tailwind · otplib.

## Setup

```bash
npm install
cp .env.example .env
npm run setup:admin:dev -- --with-encryption-key   # answer y to write the values into .env
docker compose up -d   # local Postgres on port 55433
npm run db:deploy      # apply migrations
npm run dev            # http://localhost:5173
```

### Root admin credentials: development vs production

`npm run setup:admin` asks which environment the credentials are for, so dev and production never share a login:

| Command | Output |
|---|---|
| `npm run setup:admin:dev` | `.env` lines (hash in single quotes). Can write them into `.env` for you. Authenticator label: "NazmulCodes Root (dev)". |
| `npm run setup:admin:prod` | Raw values for Vercel → Settings → Environment Variables. Writes no files. Authenticator label: "NazmulCodes Root". |

It asks whether to generate a random password (default yes). A generated password is shown once, so you can copy it into your password manager. Options, passed after `--`:

- `--generate`: random password, no question asked
- `--type-password`: type your own password (hidden)
- `--email you@example.com`: root admin email
- `--with-encryption-key`: also create `MASTER_ENCRYPTION_KEY` (new installs only)

Example: `npm run setup:admin:prod -- --generate --with-encryption-key`

Google Cloud console → OAuth client → authorized redirect URI: `${APP_BASE_URL}/auth/google/callback`.

Keep `SUPER_ADMIN_PASSWORD_HASH` in **single quotes** in `.env`. Vite's dotenv expansion corrupts `$2b$…` values. The env loader detects this and re-reads the raw `.env` file, but platform env vars (Docker/Fly/Vercel) must be set verbatim.

## Deploying to Vercel

1. **Database:** add **Prisma Postgres** from Vercel → Storage (Marketplace) and connect it to the project.
   - Set both `DATABASE_URL` and `DIRECT_URL` to the **direct `postgres://…` connection string** from the Prisma Postgres dashboard (it has built-in connection pooling). Migrations need the direct URL.
   - The `prisma+postgres://` (Accelerate) URL also passes validation, but use it only after testing it with this Prisma version.
2. **Shared store:** add **Upstash for Redis** from the Marketplace and connect it. Its `KV_REST_API_URL` / `KV_REST_API_TOKEN` are picked up automatically. The app refuses to start on Vercel without it.
3. **Other variables** (Production, mark as Sensitive): `MASTER_ENCRYPTION_KEY`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH`, `SUPER_ADMIN_TOTP_SECRET` (from `npm run setup:admin:prod -- --with-encryption-key`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL=https://auth.nazmulcodes.org`.
4. **Domain:** add `auth.nazmulcodes.org` under Settings → Domains.
5. **Deploy.** Vercel runs `npm run vercel-build`, which applies migrations (`prisma migrate deploy`) and then builds with the Vercel preset. Give Preview deployments their own database, or they will migrate production.

Keep "Automatically expose System Environment Variables" on (the default): the root lockout uses `VERCEL_DEPLOYMENT_ID` to reset on each deploy.

## Routes

| Route | Purpose |
|---|---|
| `/login`, `/register` | Email/password + Google sign-in |
| `/login/2fa` | TOTP / backup-code challenge (file: `login_.2fa.tsx`) |
| `/auth/google`, `/auth/google/callback` | Google OAuth 2.0 with state + PKCE (file: `auth.google_.callback.tsx`) |
| `/account/security` | 2FA wizard, backup codes, connected apps |
| `/root-access` | Env-backed Root Super Admin (no DB), 10-attempt hard lockout |
| `/admin/apps` | Client app registry, API key create/rotate, suspend |
| `GET /authorize` | SSO entry point → `redirect_uri?code=…&state=…` |
| `POST /api/v1/token` | Bearer API key + `code` → `{ user }` |
| `POST /api/v1/verify-user` | Bearer API key + `userId` → `{ valid, user? }` |
| `POST /api/v1/client-info` | Bearer API key → `{ clientId }` (lets the SDK work from the key alone) |

The trailing `_` in two filenames stops Remix from nesting those routes under `/login` and `/auth/google`.
`*.client.tsx` filenames are reserved by Remix for browser-only modules, so the discovery route is called `client-info`.

## Integrating a client app (e.g. Veltrix)

1. In `/admin/apps`, register the app with its callback URL(s), then copy the `nc_live_…` key (it is shown only once).
2. Store it as `NAZMULCODES_AUTH_API_KEY` in the app's Super Admin settings.
3. Copy `sdk/nazmulcodes-auth.ts` into the app (server-only):

```ts
const auth = new NazmulCodesAuthClient({
  authBaseUrl: "https://auth.nazmulcodes.org",
  apiKey: settings.NAZMULCODES_AUTH_API_KEY,
  redirectUri: "https://veltrix.app/auth/callback",
});
await auth.resolveClientId();                 // or pass { clientId: "veltrix" }

// login loader
const state = NazmulCodesAuthClient.generateState(); // save in your session
return redirect(auth.getAuthorizationUrl(state));

// callback loader: check ?state against your session first!
const user = await auth.exchangeCodeForUser(code);  // { id, email, name, avatarUrl, twoFactorEnabled }

// periodically / on sensitive actions
const { valid } = await auth.verifyUserStatus(user.id);
```

## Security notes

- **Root lockout** is global (not per-IP) by design. Anyone who can reach `/root-access` can trigger it, and that locks out the owner until a restart. The counter lives in the shared KV store, never in Postgres: in memory locally (restart `npm run dev` to unlock), in Upstash Redis on Vercel, scoped to the deployment (redeploy to unlock, or delete the `nc-auth:root:*` keys in the Upstash console). If the store is unreachable, root login fails closed (503).
- Everything sealed with `MASTER_ENCRYPTION_KEY` uses HKDF subkeys bound to a purpose, with AES-256-GCM. Rotating the key logs everyone out and makes stored 2FA secrets unreadable.
- Authorization codes are 256-bit, live for 60 seconds, are stored as SHA-256 hashes, are consumed atomically, and are bound to their client and `redirect_uri`.
- TOTP is checked in constant time across a ±1-step window, and a code's time-step can only be used once (replay guard).
- Password sign-ups are `emailVerified=false` because no email delivery is wired up. If the same email later signs in with Google, the unverified password and any 2FA on that account are wiped (protection against pre-account-takeover).
- `verify-user` returns `valid: true` only for users who are still connected to the calling app. Users can disconnect apps in `/account/security`.
- User rate limits use the same KV store. If it is unreachable they fail open (logged), so users can still sign in.
