import { cn } from "@/lib/cn";
import { type SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
