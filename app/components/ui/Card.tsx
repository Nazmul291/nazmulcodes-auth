import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-neutral-800/80 bg-neutral-900/40", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-neutral-800/80 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 text-neutral-400">{icon}</div> : null}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
          {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
