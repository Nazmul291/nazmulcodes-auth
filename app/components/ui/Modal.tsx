import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Modal({
  open,
  title,
  description,
  onClose,
  dismissible = true,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** When false, clicking the backdrop / Esc does nothing (e.g. one-time secret reveal). */
  dismissible?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => dismissible && e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn("w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl", className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-5">
          <div className="space-y-1">
            <h2 id="modal-title" className="text-sm font-semibold text-neutral-100">
              {title}
            </h2>
            {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
          </div>
          {dismissible ? (
            <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-neutral-800 p-4 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}
