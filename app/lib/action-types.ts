/** Shared action response contracts between route actions and client hooks. */

export type FieldErrors = Record<string, string>;

export type FormFailure = { ok: false; error: string; fieldErrors?: FieldErrors };

export type RootLoginActionData = FormFailure & { remaining?: number; locked?: boolean };

export type UserAuthActionData = FormFailure;

export type TwoFactorActionData =
  | { ok: true; intent: "start-setup"; enrollment: { qrDataUrl: string; otpauthUrl: string; manualKey: string } }
  | { ok: true; intent: "confirm-setup"; backupCodes: string[] }
  | { ok: true; intent: "regenerate-backup-codes"; backupCodes: string[] }
  | { ok: true; intent: "disable" }
  | { ok: true; intent: "revoke-app"; appName: string }
  | (FormFailure & { intent: TwoFactorIntent });

export type TwoFactorIntent = "start-setup" | "confirm-setup" | "regenerate-backup-codes" | "disable" | "revoke-app";

export type ClientAppIntent = "create" | "update" | "set-status" | "rotate-key";

export type ClientAppActionData =
  | { ok: true; intent: "create" | "rotate-key"; appName: string; apiKey: string }
  | { ok: true; intent: "update" | "set-status"; appName: string }
  | (FormFailure & { intent: ClientAppIntent });
