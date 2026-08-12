import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Group detail is the most-opened screen in the product, so it gets a shell
 * shaped like the real thing (breadcrumb → hero → stats → member rows) rather
 * than the generic one. The closer the skeleton matches, the less the layout
 * jumps when the data lands.
 */
export default function Loading() {
  return (
    <SkeletonScreen className="space-y-8">
      {/* Breadcrumb */}
      <Skeleton className="h-3.5 w-48" />

      {/* Hero card */}
      <section className="rounded-2xl border border-border bg-surface/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-52" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-md" />
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
      </section>

      {/* Members */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[70px] rounded-xl" />
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
