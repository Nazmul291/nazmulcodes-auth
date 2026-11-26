#!/usr/bin/env node
/**
 * Root Super Admin setup — run locally, then copy the output into your
 * environment variables (.env locally, the hosting dashboard in production):
 *   SUPER_ADMIN_PASSWORD_HASH  (bcrypt, cost 12)
 *   SUPER_ADMIN_TOTP_SECRET    (Base32, 160-bit)
 *
 * Nothing is written to disk. The password is typed hidden (or generated with
 * --generate), the TOTP QR code is drawn in the terminal, and you can confirm
 * your authenticator app works before copying the values to production.
 *
 * Usage:
 *   npm run setup:admin
 *   npm run setup:admin -- --email owner@nazmulcodes.org
 *   npm run setup:admin -- --generate          # random password, shown once
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import otplib from "otplib";
import QRCode from "qrcode";
import { parse as parseDotenv } from "dotenv";

const { authenticator } = otplib;
const ISSUER = "NazmulCodes Root";
const BCRYPT_COST = 12;

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (flag("--help") || flag("-h")) {
  console.log("Usage: npm run setup:admin -- [--email you@example.com] [--generate]");
  process.exit(0);
}

// ─── prompts ─────────────────────────────────────────────────────────────────
const interactive = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
let muted = false;
const rawWrite = rl._writeToOutput?.bind(rl);
if (rawWrite) rl._writeToOutput = (s) => (muted ? undefined : rawWrite(s));

/** Works both with a TTY and with piped stdin (lines are read in order). */
const lines = [];
const waiters = [];
rl.on("line", (line) => (waiters.length ? waiters.shift()(line) : lines.push(line)));
rl.on("close", () => waiters.splice(0).forEach((w) => w("")));

function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden && interactive;
  return new Promise((resolve) => {
    const done = (answer) => {
      if (muted) process.stdout.write("\n");
      muted = false;
      resolve(answer.trim());
    };
    lines.length ? done(lines.shift()) : waiters.push(done);
  });
}

function readEnvEmail() {
  try {
    const raw = parseDotenv(fs.readFileSync(path.resolve(process.cwd(), ".env")));
    return raw.SUPER_ADMIN_EMAIL;
  } catch {
    return undefined;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔐 NazmulCodes Root Super Admin — setup\n");

  // Email (used only as the account label in the authenticator app)
  let email = option("--email");
  if (!email) {
    const fallback = readEnvEmail() ?? "owner@nazmulcodes.org";
    email = (await ask(`Root admin email [${fallback}]: `)) || fallback;
  }
  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`"${email}" is not a valid email.`);

  // Password
  let password;
  let generated = false;
  if (flag("--generate")) {
    password = randomBytes(24).toString("base64url");
    generated = true;
  } else {
    for (;;) {
      password = await ask("Root password (min 16 chars, hidden): ", { hidden: true });
      const confirm = await ask("Confirm password: ", { hidden: true });
      if (!password) throw new Error("No password entered.");
      if (password !== confirm) {
        console.log("  ✗ Passwords do not match, try again.\n");
        if (!interactive) throw new Error("Passwords do not match.");
        continue;
      }
      if (password.length < 16) {
        console.log("  ✗ Use at least 16 characters.\n");
        if (!interactive) throw new Error("Password too short.");
        continue;
      }
      if (Buffer.byteLength(password, "utf8") > 72) {
        console.log("  ✗ Max 72 bytes (bcrypt limit).\n");
        if (!interactive) throw new Error("Password too long.");
        continue;
      }
      break;
    }
  }

  process.stdout.write("\nHashing password (bcrypt cost 12)… ");
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  if (!(await bcrypt.compare(password, hash))) throw new Error("bcrypt self-check failed.");
  console.log("done.");

  // TOTP
  const secret = authenticator.generateSecret(20);
  const uri = authenticator.keyuri(email, ISSUER, secret);
  console.log("\nScan this QR code with your authenticator app (Google Authenticator, Authy, 1Password…):\n");
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  console.log(`Or add it manually → account: ${email}  ·  key: ${secret.match(/.{1,4}/g).join(" ")}\n`);

  // Confirm the authenticator app is set up correctly
  let verified = false;
  for (let i = 0; i < 3; i++) {
    const code = (await ask("Enter the 6-digit code from the app to verify (Enter to skip): ")).replace(/\s/g, "");
    if (!code) break;
    authenticator.options = { window: 1 };
    if (authenticator.check(code, secret)) {
      verified = true;
      console.log("  ✓ Authenticator verified.");
      break;
    }
    console.log("  ✗ Code did not match. Check the phone's clock and try again.");
  }
  if (!verified) console.log("  ! Authenticator not verified — make sure it works before deploying.");

  // Output
  const bar = "─".repeat(72);
  console.log(`\n${bar}`);
  console.log("Local .env  (keep the hash in SINGLE quotes):\n");
  console.log(`SUPER_ADMIN_EMAIL="${email}"`);
  console.log(`SUPER_ADMIN_PASSWORD_HASH='${hash}'`);
  console.log(`SUPER_ADMIN_TOTP_SECRET="${secret}"`);
  console.log("\nProduction (Docker / Fly / Vercel / Railway dashboard) — paste the raw values, no quotes:\n");
  console.log(`SUPER_ADMIN_EMAIL        ${email}`);
  console.log(`SUPER_ADMIN_PASSWORD_HASH ${hash}`);
  console.log(`SUPER_ADMIN_TOTP_SECRET  ${secret}`);
  if (generated) {
    console.log(`\nGenerated root password (shown ONCE — save it in your password manager):\n\n  ${password}`);
  }
  console.log(`${bar}`);
  console.log("Changing these values signs out every existing root admin session. Restart the server after updating.");
  console.log("Clear your terminal scrollback when done (e.g. `clear && printf '\\e[3J'`).\n");
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
