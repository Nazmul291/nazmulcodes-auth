import { Check, Copy, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import type { FormEvent } from "react";
import type { TotpEnrollment, TwoFactorStep } from "~/store/useAuthStore";
import { Button, CodeInput } from "../ui";
import { BackupCodesGrid } from "./BackupCodesGrid";
import { TotpCountdown } from "./TotpCountdown";

const STEPS = ["Scan", "Verify", "Backup codes"] as const;

export function TotpSetupWizard({
  step,
  enrollment,
  backupCodes,
  starting,
  confirming,
  countdown,
  copied,
  onStart,
  onNext,
  onBack,
  onConfirm,
  onCopy,
  onFinish,
  onCancel,
  backupDownloadHref,
}: {
  step: TwoFactorStep;
  enrollment: TotpEnrollment | null;
  backupCodes: string[] | null;
  starting: boolean;
  confirming: boolean;
  countdown: { secondsLeft: number; progress: number };
  copied: boolean;
  onStart: () => void;
  onNext: () => void;
  onBack: () => void;
  onConfirm: (code: string) => void;
  onCopy: (text: string) => void;
  onFinish: () => void;
  onCancel: () => void;
  backupDownloadHref: string;
}) {
  if (step === "idle" || step === "disable") {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 text-neutral-500" />
          <p className="text-sm text-neutral-400">
            Protect every NazmulCodes app with a 6-digit code from Google Authenticator, Authy, 1Password or any TOTP app.
          </p>
        </div>
        <Button onClick={onStart} loading={starting} icon={<ShieldCheck className="h-4 w-4" />} className="shrink-0">
          Enable 2FA
        </Button>
      </div>
    );
  }

  const index = step === "scan" ? 0 : step === "verify" ? 1 : 2;

  function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onConfirm(String(new FormData(e.currentTarget).get("code") ?? ""));
  }

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                i < index
                  ? "grid h-5 w-5 place-items-center rounded-full bg-neutral-100 text-neutral-950"
                  : i === index
                    ? "grid h-5 w-5 place-items-center rounded-full border border-neutral-300 text-neutral-100"
                    : "grid h-5 w-5 place-items-center rounded-full border border-neutral-800 text-neutral-600"
              }
            >
              {i < index ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={i === index ? "text-neutral-200" : "text-neutral-600"}>{label}</span>
            {i < STEPS.length - 1 ? <span className="h-px w-4 bg-neutral-800 sm:w-8" /> : null}
          </li>
        ))}
      </ol>

      {step === "scan" && enrollment ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <img src={enrollment.qrDataUrl} alt="QR code for your authenticator app" width={176} height={176} className="rounded-lg border border-neutral-800" />
            <div className="w-full space-y-3 text-sm text-neutral-400">
              <p className="flex items-center gap-2 text-neutral-200">
                <QrCode className="h-4 w-4" /> Scan with your authenticator app
              </p>
              <p>Can't scan? Enter this key manually (time-based, 6 digits, 30s):</p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 break-all rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 font-mono text-xs text-neutral-200">{enrollment.manualKey}</code>
                <Button variant="secondary" size="sm" className="h-auto" onClick={() => onCopy(enrollment.manualKey.replace(/\s/g, ""))} aria-label="Copy setup key">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onNext}>I've scanned it</Button>
          </div>
        </div>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">Enter the current code from your app.</p>
            <TotpCountdown {...countdown} />
          </div>
          <CodeInput name="code" maxLength={6} pattern="\d{6}" placeholder="000000" autoFocus required />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" loading={confirming}>
              Verify & enable
            </Button>
          </div>
        </form>
      ) : null}

      {step === "backup" && backupCodes ? (
        <div className="space-y-4">
          <BackupCodesGrid codes={backupCodes} copied={copied} onCopy={onCopy} downloadHref={backupDownloadHref} />
          <div className="flex justify-end">
            <Button onClick={onFinish}>I've saved my codes</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
