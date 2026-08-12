import { cn } from "@/lib/cn";

/**
 * Placeholder block shown while a route's server component is still fetching.
 *
 * These render from `loading.tsx` files, which is what makes a tap feel
 * instant: Next swaps to this shell the moment the user taps, instead of
 * leaving them on the previous screen with no feedback until the whole
 * server render resolves.
 *
 * `aria-hidden` because the skeleton carries no information — the loading
 * state is announced once, by the wrapper, rather than by every bar.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
    />
  );
}

/**
 * Wraps a skeleton screen so assistive tech announces one "Cargando…" instead
 * of nothing at all (the bars themselves are aria-hidden).
 */
export function SkeletonScreen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
