import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-neutral-100 text-neutral-950 hover:bg-white disabled:bg-neutral-400",
  secondary: "border border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-neutral-700 hover:bg-neutral-800",
  ghost: "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100",
  danger: "border border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-800 hover:bg-red-950/70",
};
const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Same look as Button, for plain navigational links (e.g. Google OAuth redirect). */
export function ButtonLink({
  href,
  variant = "secondary",
  icon,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
        variants[variant],
        className,
      )}
    >
      {icon}
      {children}
    </a>
  );
}
