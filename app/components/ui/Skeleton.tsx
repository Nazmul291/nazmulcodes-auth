import { cn } from "./cn";

/** Shimmer placeholder. The `.loading` class is defined in tailwind.css. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("loading rounded-md", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-800/80 p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
