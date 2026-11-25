import { KeyRound, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, Button, Input, Modal } from "../ui";

type Pending = "disable" | "regenerate-backup-codes" | null;

/** Shown when 2FA is already enabled. Both actions re-verify with a fresh code. */
export function TwoFactorManage({
  remainingBackupCodes,
  pending,
  onDisable,
  onRegenerate,
}: {
  remainingBackupCodes: number;
  pending: Pending;
  onDisable: (code: string) => void;
  onRegenerate: (code: string) => void;
}) {
  const [dialog, setDialog] = useState<Pending>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    if (dialog === "disable") onDisable(code);
    if (dialog === "regenerate-backup-codes") onRegenerate(code);
    setDialog(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-neutral-200">
          Authenticator app <Badge tone="success">Enabled</Badge>
        </p>
        <p className="text-xs text-neutral-500">
          {remainingBackupCodes} of 8 backup codes remaining
          {remainingBackupCodes <= 2 ? " — generate new ones soon." : "."}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} loading={pending === "regenerate-backup-codes"} onClick={() => setDialog("regenerate-backup-codes")}>
          New backup codes
        </Button>
        <Button variant="danger" size="sm" icon={<ShieldOff className="h-3.5 w-3.5" />} loading={pending === "disable"} onClick={() => setDialog("disable")}>
          Disable 2FA
        </Button>
      </div>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "disable" ? "Disable two-factor authentication?" : "Generate new backup codes?"}
        description={
          dialog === "disable"
            ? "Your account will be protected by your password or Google sign-in only."
            : "All existing backup codes will stop working."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Authenticator or backup code" name="code" autoComplete="one-time-code" autoFocus required className="font-mono tracking-widest" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={dialog === "disable" ? "danger" : "primary"}>
              Confirm
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
