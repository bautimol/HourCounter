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
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
