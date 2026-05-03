import { cn } from "@/lib/cn";

type Variant = "neutral" | "accent" | "muted";

const variants: Record<Variant, string> = {
  neutral: "bg-surface text-foreground border border-border",
  accent: "bg-accent-soft text-accent-soft-foreground",
  muted: "bg-surface-muted text-muted-foreground",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
