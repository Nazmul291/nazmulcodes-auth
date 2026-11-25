import { AppWindow, Unplug } from "lucide-react";
import { Button } from "../ui";

export interface ConnectedApp {
  clientAppId: string;
  name: string;
  slug: string;
  firstConnectedAt: string;
  lastUsedAt: string;
}

const rel = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function ConnectedAppsList({
  apps,
  revokingId,
  onRevoke,
}: {
  apps: ConnectedApp[];
  revokingId: string | null;
  onRevoke: (clientAppId: string) => void;
}) {
  if (apps.length === 0) {
    return <p className="text-sm text-neutral-500">You haven't signed in to any NazmulCodes apps yet.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-800/80">
      {apps.map((app) => (
        <li key={app.clientAppId} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-800 bg-neutral-900">
              <AppWindow className="h-4 w-4 text-neutral-400" />
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-200">{app.name}</p>
              <p className="text-xs text-neutral-500">
                Connected {rel(app.firstConnectedAt)} · last used {rel(app.lastUsedAt)}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<Unplug className="h-3.5 w-3.5" />} loading={revokingId === app.clientAppId} onClick={() => onRevoke(app.clientAppId)}>
            Disconnect
          </Button>
        </li>
      ))}
    </ul>
  );
}
