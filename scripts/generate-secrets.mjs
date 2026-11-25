#!/usr/bin/env node
// Generates the Root Super Admin + encryption secrets for .env.
// Usage: npm run secrets -- "<root password>" [owner@email]
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import otplib from "otplib";

const [password, email = "owner@nazmulcodes.org"] = process.argv.slice(2);

if (!password || password.length < 16) {
  console.error('Usage: npm run secrets -- "<root password, min 16 chars>" [email]');
  process.exit(1);
}
if (Buffer.byteLength(password, "utf8") > 72) {
  console.error("Password must be at most 72 bytes (bcrypt limit).");
  process.exit(1);
}

const { authenticator } = otplib;
const totpSecret = authenticator.generateSecret(20);
const hash = bcrypt.hashSync(password, 12);
const otpauth = authenticator.keyuri(email, "NazmulCodes Root", totpSecret);

console.log(`
# ── paste into .env ──
MASTER_ENCRYPTION_KEY="${randomBytes(32).toString("hex")}"
SUPER_ADMIN_EMAIL="${email}"
SUPER_ADMIN_PASSWORD_HASH='${hash}'
SUPER_ADMIN_TOTP_SECRET="${totpSecret}"

# Add the TOTP secret to your authenticator app (manual entry), or open this URI:
# ${otpauth}
`);
