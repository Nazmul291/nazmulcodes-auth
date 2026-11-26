#!/usr/bin/env node
/**
 * Root Super Admin setup — run on your own machine, never on a server.
 *
 * Generates:
 *   SUPER_ADMIN_PASSWORD_HASH  (bcrypt, cost 12) from a password you type or a random one
 *   SUPER_ADMIN_TOTP_SECRET    (Base32, 160-bit) + QR code for your authenticator app
 *   MASTER_ENCRYPTION_KEY      (only with --with-encryption-key, for a new install)
 *
 * Two separate targets, so dev and production never share credentials:
 *   development → .env format (hash in single quotes); can write the values into .env for you
 *   production  → raw values for Vercel → Settings → Environment Variables; writes nothing
 *
 * Usage:
 *   npm run setup:admin                                  # asks for everything
 *   npm run setup:admin:dev                              # development, asks the rest
 *   npm run setup:admin:prod                             # production, asks the rest
 *
 * Options (after `--`, e.g. `npm run setup:admin:prod -- --generate`):
 *   --env development|production   target (aliases: dev, prod)
 *   --generate                     random password (shown once so you can copy it)
 *   --type-password                type your own password instead (hidden)
 *   --email you@example.com        root admin email
 *   --with-encryption-key          also generate MASTER_ENCRYPTION_KEY (new installs only!)
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
const BCRYPT_COST = 12;
const ENV_FILE = path.resolve(process.cwd(), ".env");

const TARGETS = {
  development: { label: "DEVELOPMENT", issuer: "NazmulCodes Root (dev)" },
  production: { label: "PRODUCTION", issuer: "NazmulCodes Root" },
};

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (flag("--help") || flag("-h")) {
  console.log(
    "Usage: npm run setup:admin -- [--env development|production] [--generate | --type-password]\n" +
      "                             [--email you@example.com] [--with-encryption-key]",
  );
  process.exit(0);
}

function normalizeTarget(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (["dev", "development", "local", "1"].includes(v)) return "development";
  if (["prod", "production", "2"].includes(v)) return "production";
  return null;
}

// ─── prompts (work with a TTY and with piped stdin) ──────────────────────────
const interactive = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
let muted = false;
const rawWrite = rl._writeToOutput?.bind(rl);
if (rawWrite) rl._writeToOutput = (s) => (muted ? undefined : rawWrite(s));

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

async function confirm(question, defaultYes) {
  const answer = (await ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

// ─── .env helpers ────────────────────────────────────────────────────────────
function readEnvFile() {
  try {
    return parseDotenv(fs.readFileSync(ENV_FILE));
  } catch {
    return {};
  }
}

/** Replaces `KEY=…` lines in .env (or appends them), keeping everything else. */
function writeEnvValues(values) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  for (const [key, line] of Object.entries(values)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, () => line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  }
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
  fs.chmodSync(ENV_FILE, 0o600);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── steps ───────────────────────────────────────────────────────────────────
async function chooseTarget() {
  const fromFlag = option("--env");
  if (fromFlag !== undefined) {
    const t = normalizeTarget(fromFlag);
    if (!t) throw new Error(`--env must be "development" or "production" (got "${fromFlag}").`);
    return t;
  }
  for (;;) {
    console.log("Which environment are these credentials for?");
    console.log("  1) development  (this computer, .env)");
    console.log("  2) production   (Vercel → auth.nazmulcodes.org)");
    const t = normalizeTarget(await ask("Choose 1 or 2: "));
    if (t) return t;
    console.log("  ✗ Please type 1 or 2.\n");
    if (!interactive) throw new Error("No environment chosen.");
  }
}

async function chooseEmail() {
  let email = option("--email");
  if (!email) {
    const fallback = readEnvFile().SUPER_ADMIN_EMAIL ?? "owner@nazmulcodes.org";
    email = (await ask(`Root admin email [${fallback}]: `)) || fallback;
  }
  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`"${email}" is not a valid email.`);
  return email;
}

/** Returns { password, generated }. */
async function choosePassword() {
  let generate;
  if (flag("--generate")) generate = true;
  else if (flag("--type-password")) generate = false;
  else generate = await confirm("Generate a random password for you?", true);

  if (generate) return { password: randomBytes(24).toString("base64url"), generated: true };

  for (;;) {
    const password = await ask("Root password (min 16 chars, hidden): ", { hidden: true });
    const again = await ask("Confirm password: ", { hidden: true });
    let problem = null;
    if (!password) problem = "No password entered.";
    else if (password !== again) problem = "Passwords do not match.";
    else if (password.length < 16) problem = "Use at least 16 characters.";
    else if (Buffer.byteLength(password, "utf8") > 72) problem = "Max 72 bytes (bcrypt limit).";
    if (!problem) return { password, generated: false };
    console.log(`  ✗ ${problem}\n`);
    if (!interactive) throw new Error(problem);
  }
}

async function verifyAuthenticator(secret) {
  authenticator.options = { window: 1 };
  for (let i = 0; i < 3; i++) {
    const code = (await ask("Enter the 6-digit code from the app to verify (Enter to skip): ")).replace(/\s/g, "");
    if (!code) break;
    if (authenticator.check(code, secret)) {
      console.log("  ✓ Authenticator verified.");
      return true;
    }
    console.log("  ✗ Code did not match. Check the phone's clock and try again.");
  }
  console.log("  ! Authenticator not verified — make sure it works before using these values.");
  return false;
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔐 NazmulCodes Root Super Admin — setup\n");

  const target = await chooseTarget();
  const { label, issuer } = TARGETS[target];
  console.log(`\n→ Target: ${label}\n`);

  const email = await chooseEmail();
  const { password, generated } = await choosePassword();

  process.stdout.write("\nHashing password (bcrypt cost 12)… ");
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  if (!(await bcrypt.compare(password, hash))) throw new Error("bcrypt self-check failed.");
  console.log("done.");

  const secret = authenticator.generateSecret(20);
  const uri = authenticator.keyuri(email, issuer, secret);
  const masterKey = flag("--with-encryption-key") ? randomBytes(32).toString("hex") : null;

  console.log(`\nScan this QR code with your authenticator app — it will show as "${issuer}":\n`);
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  console.log(`Or add it manually → account: ${email}  ·  key: ${secret.match(/.{1,4}/g).join(" ")}\n`);
  await verifyAuthenticator(secret);

  const bar = "─".repeat(72);
  console.log(`\n${bar}\n  ${label} — root admin credentials\n${bar}`);

  console.log("\n1) Save in your password manager (you need these to log in at /root-access):\n");
  console.log(`   Email:       ${email}`);
  console.log(`   Password:    ${generated ? password : "(the password you typed)"}`);
  console.log(`   TOTP secret: ${secret}`);
  if (generated) console.log("\n   ⚠ The generated password is shown only now. Copy it before closing this terminal.");

  if (target === "production") {
    console.log("\n2) Vercel → Project → Settings → Environment Variables");
    console.log("   Environment: Production · turn on \"Sensitive\" · paste the values WITHOUT quotes:\n");
    if (masterKey) console.log(`   MASTER_ENCRYPTION_KEY      ${masterKey}`);
    console.log(`   SUPER_ADMIN_EMAIL          ${email}`);
    console.log(`   SUPER_ADMIN_PASSWORD_HASH  ${hash}`);
    console.log(`   SUPER_ADMIN_TOTP_SECRET    ${secret}`);
    console.log("\n   Then redeploy, and test a login at https://auth.nazmulcodes.org/root-access.");
    console.log("   Never reuse these values in development.");
  } else {
    const envLines = {
      ...(masterKey ? { MASTER_ENCRYPTION_KEY: `MASTER_ENCRYPTION_KEY="${masterKey}"` } : {}),
      SUPER_ADMIN_EMAIL: `SUPER_ADMIN_EMAIL="${email}"`,
      SUPER_ADMIN_PASSWORD_HASH: `SUPER_ADMIN_PASSWORD_HASH='${hash}'`,
      SUPER_ADMIN_TOTP_SECRET: `SUPER_ADMIN_TOTP_SECRET="${secret}"`,
    };
    console.log("\n2) .env (keep the hash in SINGLE quotes):\n");
    for (const line of Object.values(envLines)) console.log(`   ${line}`);

    const existing = readEnvFile();
    if (masterKey && existing.MASTER_ENCRYPTION_KEY && !/^0+$/.test(existing.MASTER_ENCRYPTION_KEY)) {
      console.log("\n   ⚠ .env already has a MASTER_ENCRYPTION_KEY. Replacing it signs out every user");
      console.log("     and makes stored 2FA secrets unreadable.");
    }
    console.log("");
    if (await confirm(`Write these values into ${path.relative(process.cwd(), ENV_FILE) || ".env"} now?`, false)) {
      writeEnvValues(envLines);
      console.log("   ✓ .env updated. Restart `npm run dev` to use the new login.");
    } else {
      console.log("   .env not changed — copy the lines above yourself.");
    }
  }

  console.log(`\n${bar}`);
  if (masterKey) {
    console.log("MASTER_ENCRYPTION_KEY is for a NEW install. Replacing an existing one signs out every user");
    console.log("and makes stored 2FA secrets unreadable.");
  }
  console.log("Changing these values signs out every existing root admin session.");
  console.log("Clear your terminal scrollback when done (e.g. `clear && printf '\\e[3J'`).\n");
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
