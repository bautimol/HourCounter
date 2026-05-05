import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm",
        "shadow-xs",
        "placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--ring-color)_/_0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium tracking-tight text-foreground",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
