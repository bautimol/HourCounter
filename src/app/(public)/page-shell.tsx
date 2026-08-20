import { cn } from "@/lib/cn";

/**
 * Heading + body wrapper shared by the public content pages, so the four of
 * them line up instead of each inventing its own measure and rhythm.
 *
 * `max-w-2xl` is a reading measure, not a layout choice: these are pages of
 * running prose, and full-width paragraphs on a laptop are what make terms
 * pages unreadable.
 */
export function PageShell({
  title,
  intro,
  meta,
  children,
  className,
}: {
  title: string;
  intro?: string;
  /** Small line under the title — e.g. "Última actualización: …". */
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl", className)}>
      <header>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
            {intro}
          </p>
        )}
        {meta && (
          <p className="mt-4 text-xs text-muted-foreground">{meta}</p>
        )}
      </header>

      <div className="mt-12">{children}</div>
    </div>
  );
}

/** A numbered section of a legal document. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list with the spacing the sections expect. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
