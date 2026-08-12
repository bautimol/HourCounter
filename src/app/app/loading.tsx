import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Fallback loading shell for every authenticated route that doesn't define its
 * own. Shaped like <PageHeader> + a list, which is what most screens here are.
 *
 * Having this file at all changes two things beyond the visible skeleton:
 * the tap now swaps the screen immediately instead of freezing on the old one,
 * and Next starts prefetching links to these routes (dynamic routes are only
 * prefetched when a loading boundary exists).
 */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-8">
      {/* PageHeader: icon tile + title + subtitle, action on the right */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Content rows */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
    </SkeletonScreen>
  );
}
