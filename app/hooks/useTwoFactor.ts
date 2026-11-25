import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect } from "react";
import type { TwoFactorActionData, TwoFactorIntent } from "~/lib/action-types";
import { useAuthStore } from "~/store/useAuthStore";

const ACTION = "/account/security";

/**
 * Drives the TOTP setup wizard, disable flow, backup-code regeneration and
 * connected-app revocation via the /account/security action.
 */
export function useTwoFactor() {
  const fetcher = useFetcher<TwoFactorActionData>();
  const { setTwoFactorStep, setEnrollment, setBackupCodes, resetTwoFactorWizard, pushToast } = useAuthStore();

  const pendingIntent = fetcher.formData?.get("intent") as TwoFactorIntent | undefined;

  useEffect(() => {
    const data = fetcher.data;
    if (!data || fetcher.state !== "idle") return;
    if (!data.ok) {
      pushToast("error", data.error);
      return;
    }
    switch (data.intent) {
      case "start-setup":
        setEnrollment(data.enrollment);
        setTwoFactorStep("scan");
        break;
      case "confirm-setup":
        setEnrollment(null);
        setBackupCodes(data.backupCodes);
        setTwoFactorStep("backup");
        pushToast("success", "Two-factor authentication is now enabled.");
        break;
      case "regenerate-backup-codes":
        setBackupCodes(data.backupCodes);
        setTwoFactorStep("backup");
        pushToast("success", "New backup codes generated. Old codes no longer work.");
        break;
      case "disable":
        resetTwoFactorWizard();
        pushToast("info", "Two-factor authentication disabled.");
        break;
      case "revoke-app":
        pushToast("info", `Disconnected ${data.appName}.`);
        break;
    }
  }, [fetcher.data, fetcher.state, pushToast, resetTwoFactorWizard, setBackupCodes, setEnrollment, setTwoFactorStep]);

  const send = useCallback(
    (intent: TwoFactorIntent, values: Record<string, string> = {}) =>
      fetcher.submit({ intent, ...values }, { method: "post", action: ACTION }),
    [fetcher],
  );

  return {
    startSetup: () => send("start-setup"),
    confirmSetup: (code: string) => send("confirm-setup", { code }),
    disable: (code: string) => send("disable", { code }),
    regenerateBackupCodes: (code: string) => send("regenerate-backup-codes", { code }),
    revokeApp: (clientAppId: string) => send("revoke-app", { clientAppId }),
    pendingIntent: fetcher.state !== "idle" ? pendingIntent ?? null : null,
    revokingId:
      fetcher.state !== "idle" && pendingIntent === "revoke-app"
        ? String(fetcher.formData?.get("clientAppId") ?? "")
        : null,
    lastError: fetcher.data && !fetcher.data.ok ? fetcher.data.error : null,
  };
}
