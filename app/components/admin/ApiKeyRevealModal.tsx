import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import type { RevealedApiKey } from "~/store/useAuthStore";
import { Alert, Button, Modal } from "../ui";

/** Shows the full API key exactly once. Cannot be dismissed by backdrop/Esc. */
export function ApiKeyRevealModal({
  revealed,
  copied,
  onCopy,
  onClose,
}: {
  revealed: RevealedApiKey | null;
  copied: boolean;
  onCopy: (key: string) => void;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  if (!revealed) return null;

  const close = () => {
    setAcknowledged(false);
    onClose();
  };

  return (
    <Modal
      open
      dismissible={false}
      onClose={close}
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> {revealed.reason === "created" ? "API key created" : "API key rotated"} · {revealed.appName}
        </span>
      }
      description="Copy this key now. It is stored only as a SHA-256 hash and will never be shown again."
      footer={
        <Button onClick={close} disabled={!acknowledged}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-stretch gap-2">
          <code className="flex-1 break-all rounded-lg border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-200">
            {revealed.apiKey}
          </code>
          <Button variant="secondary" onClick={() => onCopy(revealed.apiKey)} aria-label="Copy API key" className="h-auto">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {revealed.reason === "rotated" ? (
          <Alert tone="locked">The previous key stopped working immediately. Update the app's Super Admin settings now.</Alert>
        ) : null}
        <p className="text-xs text-neutral-500">
          In the client app, store it as <code className="font-mono text-neutral-300">NAZMULCODES_AUTH_API_KEY</code>.
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="h-4 w-4 accent-neutral-100" />
          I have stored this key somewhere safe.
        </label>
      </div>
    </Modal>
  );
}
