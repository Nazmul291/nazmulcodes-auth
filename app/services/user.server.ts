import type { CentralUser } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "~/lib/db.server";
import { audit } from "./audit.server";

const BCRYPT_COST = 12;
// Pre-computed hash used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync("nazmulcodes-timing-equaliser", BCRYPT_COST);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function registerWithPassword(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await db.centralUser.findUnique({ where: { email } });
  if (existing) return { ok: false as const, error: "An account with this email already exists. Try signing in." };

  const user = await db.centralUser.create({
    data: {
      email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
      // No email delivery is configured, so password sign-ups are unverified until
      // the same address signs in with Google (which proves ownership).
      emailVerified: false,
    },
  });
  return { ok: true as const, user };
}

/** Constant-ish time: always runs exactly one bcrypt comparison. */
export async function verifyPasswordLogin(emailInput: string, password: string): Promise<CentralUser | null> {
  const user = await db.centralUser.findUnique({ where: { email: normalizeEmail(emailInput) } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return null;
  return user;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Finds or creates the CentralUser for a Google identity, auto-linking by
 * verified email.
 *
 * Pre-account-takeover defence: if an UNVERIFIED password account already
 * exists for this email, someone may have registered it before the real owner.
 * Google proves ownership, so we wipe the unverified password and any 2FA the
 * squatter configured, revoke their sessions, and hand the account to the
 * verified owner.
 */
export async function upsertGoogleUser(profile: GoogleProfile, request: Request): Promise<CentralUser> {
  if (!profile.emailVerified) throw new Error("Google account email is not verified.");
  const email = normalizeEmail(profile.email);

  const byGoogle = await db.centralUser.findUnique({ where: { googleId: profile.sub } });
  if (byGoogle) {
    return db.centralUser.update({
      where: { id: byGoogle.id },
      data: { avatarUrl: byGoogle.avatarUrl ?? profile.picture, name: byGoogle.name ?? profile.name },
    });
  }

  const byEmail = await db.centralUser.findUnique({ where: { email } });
  if (!byEmail) {
    const created = await db.centralUser.create({
      data: { email, emailVerified: true, googleId: profile.sub, name: profile.name, avatarUrl: profile.picture },
    });
    void audit({ actorType: "USER", actorId: created.id, action: "user.register.google", request });
    return created;
  }

  if (byEmail.googleId && byEmail.googleId !== profile.sub) {
    throw new Error("This email is already linked to a different Google account.");
  }

  const squatted = !byEmail.emailVerified;
  const linked = await db.$transaction(async (tx) => {
    if (squatted) await tx.backupCode.deleteMany({ where: { userId: byEmail.id } });
    return tx.centralUser.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        emailVerified: true,
        avatarUrl: byEmail.avatarUrl ?? profile.picture,
        name: byEmail.name ?? profile.name,
        ...(squatted && {
          passwordHash: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          twoFactorLastUsedStep: null,
          sessionVersion: { increment: 1 },
        }),
      },
    });
  });
  void audit({
    actorType: "USER",
    actorId: linked.id,
    action: squatted ? "user.link.google.reclaimed_unverified" : "user.link.google",
    request,
  });
  return linked;
}
