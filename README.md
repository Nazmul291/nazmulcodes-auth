# NazmulCodes Auth

Central Identity Provider & SSO for the NazmulCodes ecosystem (Veltrix, Stockly, Badgify, Kilo, …).
Remix (Vite, strict TS) · Prisma/PostgreSQL · Zustand · Tailwind · otplib.

## Setup

```bash
npm install
cp .env.example .env
npm run secrets -- "<a long root password>" you@nazmulcodes.org   # paste output into .env
npm run db:push        # or: npm run db:migrate
npm run dev            # http://localhost:5173
```

To set up or change only the root admin login (email, password, authenticator), run:

```bash
npm run setup:admin               # hidden password prompt, terminal QR code, verifies your authenticator
npm run setup:admin -- --generate # random password, shown once
```

It writes nothing to disk. It prints values for `.env` and raw values for your hosting dashboard in production.

Google Cloud console → OAuth client → authorized redirect URI: `${APP_BASE_URL}/auth/google/callback`.

Keep `SUPER_ADMIN_PASSWORD_HASH` in **single quotes** in `.env`. Vite's dotenv expansion corrupts `$2b$…` values. The env loader detects this and re-reads the raw `.env` file, but platform env vars (Docker/Fly/Vercel) must be set verbatim.

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

- **Root lockout** is global (not per-IP) by design. Anyone who can reach `/root-access` can trigger it, and that locks out the owner until a restart. To make the lock survive restarts, set `LOCKOUT_PERSISTENCE = "file"` in `app/services/super-admin.server.ts` (writes `.data/root-lockout.json`). The counter is per-process: run a single instance or move it to a shared store.
- Everything sealed with `MASTER_ENCRYPTION_KEY` uses HKDF subkeys bound to a purpose, with AES-256-GCM. Rotating the key logs everyone out and makes stored 2FA secrets unreadable.
- Authorization codes are 256-bit, live for 60 seconds, are stored as SHA-256 hashes, are consumed atomically, and are bound to their client and `redirect_uri`.
- TOTP is checked in constant time across a ±1-step window, and a code's time-step can only be used once (replay guard).
- Password sign-ups are `emailVerified=false` because no email delivery is wired up. If the same email later signs in with Google, the unverified password and any 2FA on that account are wiped (protection against pre-account-takeover).
- `verify-user` returns `valid: true` only for users who are still connected to the calling app. Users can disconnect apps in `/account/security`.
- The user rate limiter is in memory. Swap it for Redis/KV if you run multiple instances.
