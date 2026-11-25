import { Check, Copy, Download } from "lucide-react";
import { Button } from "../ui";

export function BackupCodesGrid({
  codes,
  copied,
  onCopy,
  downloadHref,
}: {
  codes: string[];
  copied: boolean;
  onCopy: (text: string) => void;
  downloadHref: string;
}) {
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        {codes.map((code, i) => (
          <li key={code} className="flex items-center gap-2 font-mono text-sm text-neutral-200">
            <span className="w-4 text-right text-[11px] text-neutral-600">{i + 1}</span>
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" size="sm" icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => onCopy(codes.join("\n"))}>
          {copied ? "Copied" : "Copy all"}
        </Button>
        <a
          href={downloadHref}
          download="nazmulcodes-backup-codes.txt"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
        >
          <Download className="h-3.5 w-3.5" /> Download .txt
        </a>
      </div>
      <p className="text-xs text-neutral-500">Each code works once. Store them in a password manager — they will not be shown again.</p>
    </div>
  );
}
