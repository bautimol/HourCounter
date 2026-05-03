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
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm",
        "placeholder:text-muted-foreground",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
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
      className={cn("text-sm font-medium text-foreground", className)}
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
