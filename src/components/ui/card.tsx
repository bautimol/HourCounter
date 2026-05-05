import { cn } from "@/lib/cn";

/**
 * Surface card. Subtle top-to-bottom gradient gives a hint of depth on
 * dark mode (lit-from-above) and looks completely flat on light mode.
 */
export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-xs",
        "bg-gradient-to-b from-surface to-surface",
        "dark:from-surface-elevated/80 dark:to-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 pt-5 pb-3", className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-base font-semibold leading-tight tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-t border-border px-5 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
