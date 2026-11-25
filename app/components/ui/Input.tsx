import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const base =
  "w-full rounded-lg border bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500/40 disabled:opacity-60";

function borderFor(error?: string) {
  return error ? "border-red-800 focus:border-red-700" : "border-neutral-800 focus:border-neutral-600";
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function Input({ label, error, hint, className, id, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-xs font-medium text-neutral-400">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className={cn(base, "h-10", borderFor(error), className)}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-err`} className="text-xs text-red-400">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-neutral-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-neutral-400">
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        className={cn(base, "min-h-[84px] py-2 font-mono text-xs", borderFor(error), className)}
        {...rest}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** Large, centred one-time-code input. */
export const CodeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  function CodeInput({ error, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        className={cn(base, "h-14 text-center font-mono text-2xl tracking-[0.4em]", borderFor(error), className)}
        {...rest}
      />
    );
  },
);
