import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Crumb = {
  label: string;
  href?: string; // last crumb usually has no href
};

/**
 * Consistent page header used across the authenticated area.
 *
 *   <PageHeader
 *     crumbs={[{ label: "Tus grupos", href: "/app" }, { label: groupName }]}
 *     title="Roles"
 *     subtitle="Plantillas de empleado del grupo."
 *     actions={<Link ...>Crear rol</Link>}
 *     icon={<Briefcase />}
 *     accent="emerald"
 *   />
 */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
  icon,
  accent = "neutral",
  back,
}: {
  crumbs?: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  /** Optional colored "tile" tint behind the icon. */
  accent?: "neutral" | "emerald";
  /** Convenience for a single back link if breadcrumbs aren't needed. */
  back?: { label: string; href: string };
}) {
  const accentClass =
    accent === "emerald"
      ? "bg-accent text-accent-foreground shadow-sm shadow-emerald-600/30"
      : "bg-surface-muted text-foreground";

  return (
    <header className="space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}

      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Migajas" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {c.href && !isLast ? (
                    <Link href={c.href} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(isLast ? "text-foreground" : undefined)}
                    >
                      {c.label}
                    </span>
                  )}
                  {!isLast && <span aria-hidden>/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                accentClass,
              )}
              aria-hidden
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
