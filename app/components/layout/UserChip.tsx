import { LogOut } from "lucide-react";
import { Button } from "../ui";

export function UserChip({
  label,
  sublabel,
  avatarUrl,
  onLogout,
  loggingOut,
}: {
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  loggingOut?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium text-neutral-200">{label}</p>
        {sublabel ? <p className="text-[11px] text-neutral-500">{sublabel}</p> : null}
      </div>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-neutral-800 grayscale" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full border border-neutral-800 bg-neutral-900 text-xs font-medium text-neutral-300">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={onLogout} loading={loggingOut} icon={<LogOut className="h-3.5 w-3.5" />} aria-label="Sign out">
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
