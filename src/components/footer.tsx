import Link from "next/link";
import { Logo } from "@/components/logo";
import { SUPPORT_EMAIL } from "@/lib/support";
import { cn } from "@/lib/cn";

/**
 * Public footer.
 *
 * Two shapes rather than two components, because the links have to stay in
 * step: `full` for pages with room (landing, content pages), `compact` for the
 * auth column, where a four-column block under a login form would outweigh the
 * form itself.
 *
 * Every entry here resolves to a page that exists. A footer whose links 404 is
 * worse than the single copyright line this replaced — it advertises help that
 * is not there.
 */

const LINKS = {
  producto: [
    { href: "/signup", label: "Crear cuenta" },
    { href: "/login", label: "Iniciar sesión" },
    { href: "/nosotros", label: "Sobre nosotros" },
  ],
  ayuda: [
    { href: "/faq", label: "Preguntas frecuentes" },
    { href: "/soporte", label: "Soporte" },
  ],
  legal: [
    { href: "/terminos", label: "Términos" },
    { href: "/privacidad", label: "Privacidad" },
  ],
};

/** Flattened for the compact row, where the grouping would just add noise. */
const COMPACT_LINKS = [...LINKS.ayuda, ...LINKS.legal];

function Column({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6 text-xs text-muted-foreground",
          className,
        )}
      >
        <span>© {year} Clockity</span>
        {COMPACT_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {item.label}
          </Link>
        ))}
      </footer>
    );
  }

  return (
    <footer className={cn("mx-auto max-w-6xl px-4 pb-10", className)}>
      <div className="border-t border-border pt-10">
        {/* Two columns on a phone, not one: stacked, the three link groups
            made the footer 620px tall — three quarters of the screen on the
            device most of these users are on. */}
        <div className="grid grid-cols-2 gap-8 sm:gap-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1 lg:pr-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <Logo className="h-6 w-6 text-accent" />
              <span className="text-sm font-semibold tracking-tight">
                Clockity
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Horas trabajadas y cuentas claras, para los dos lados.
            </p>
          </div>

          <Column title="Producto" items={LINKS.producto} />
          <Column title="Ayuda" items={LINKS.ayuda} />
          <Column title="Legal" items={LINKS.legal} />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© {year} Clockity</p>
          {/* Spelled out rather than hidden behind "Contacto": someone who
              needs help should be able to write without another click. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
