import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight " +
  "transition-[background-color,opacity,transform,box-shadow] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  // Primary: solid emerald with subtle inner highlight (1px white inset on
  // top) and a colored shadow. Hover slightly lifts via brightness.
  primary:
    "bg-accent text-accent-foreground shadow-sm shadow-emerald-700/25 " +
    "ring-1 ring-inset ring-white/15 " +
    "hover:bg-accent-hover hover:shadow-md hover:shadow-emerald-700/30",
  secondary:
    "bg-surface text-foreground border border-border shadow-xs " +
    "hover:bg-surface-muted hover:border-border-strong",
  ghost:
    "text-foreground hover:bg-surface-muted",
  danger:
    "bg-danger text-white shadow-sm shadow-red-700/25 " +
    "ring-1 ring-inset ring-white/15 " +
    "hover:opacity-90 hover:shadow-md hover:shadow-red-700/30",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-12 px-5 text-base font-semibold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
