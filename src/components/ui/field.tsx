import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

const base =
  "w-full rounded border border-line bg-surface-2 text-sm text-fg placeholder:text-fg-3 transition-colors hover:border-line-strong focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }>(
  function Input({ className, prefix, suffix, ...rest }, ref) {
    if (!prefix && !suffix) return <input ref={ref} className={cn(base, "h-8 px-2.5", className)} {...rest} />;
    return (
      <div className={cn("relative flex items-center", className)}>
        {prefix && <span className="pointer-events-none absolute left-2.5 text-sm text-fg-3">{prefix}</span>}
        <input ref={ref} className={cn(base, "h-8 num", prefix ? "pl-6" : "pl-2.5", suffix ? "pr-8" : "pr-2.5")} {...rest} />
        {suffix && <span className="pointer-events-none absolute right-2.5 text-xs text-fg-3">{suffix}</span>}
      </div>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        base,
        "h-8 appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pl-2.5 pr-7",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[72px] px-2.5 py-2 leading-5", className)} {...rest} />;
});

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between text-xs font-medium text-fg-2">
      <span>{children}</span>
      {hint && <span className="font-normal text-fg-3">{hint}</span>}
    </label>
  );
}
