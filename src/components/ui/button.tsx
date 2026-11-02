import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "positive";
type Size = "xs" | "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary/90 border border-transparent",
  secondary: "bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-3 border border-transparent",
  danger: "bg-neg-bg text-neg border border-neg/30 hover:border-neg/60",
  positive: "bg-pos text-[#06140e] border border-transparent hover:bg-pos/90",
};
const sizes: Record<Size, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded-sm",
  sm: "h-7 px-2.5 text-sm gap-1.5 rounded",
  md: "h-8 px-3 text-sm gap-2 rounded",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        icon && (size === "xs" ? "w-6 px-0" : size === "sm" ? "w-7 px-0" : "w-8 px-0"),
        className,
      )}
      {...rest}
    >
      {loading ? <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});
