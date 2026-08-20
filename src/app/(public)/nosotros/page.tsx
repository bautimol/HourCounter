import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { PageShell, List } from "../page-shell";

export const metadata: Metadata = {
  title: "Sobre nosotros · Clockity",
  // Shown in search results and in the WhatsApp link preview, so it says who
  // we are rather than what the app does — the landing already covers that.
  description:
    "Quiénes hacemos Clockity, por qué lo construimos y cómo se sostiene.",
};

/**
 * Sobre nosotros.
 *
 * This page answers one question — "¿quién está atrás de esto y por qué le
 * confiaría los sueldos de mi local?" — and everything here is arranged around
 * it. For a two-person operation, looking like a company is what reads as
 * amateur; specificity is what reads as professional. Hence real names, a real
 * reason, and a section that says who this is NOT for.
 *
 * It deliberately does NOT use `Section` from page-shell: that one is styled
 * for numbered legal clauses, and this page should not read like the terms.
 * It does reuse `PageShell` so the measure and the heading rhythm line up with
 * /faq, /soporte, /terminos and /privacidad.
 */

/**
 * No avatars by choice: for two people, a name and a plain line about what they
 * do carries the page, and initial-circles would read as a team page pretending
 * to be bigger than the team.
 */
const PEOPLE: { name: string; role: string; blurb: string }[] = [
  {
    name: "Bautista Molina",
    role: "Producto y desarrollo",
    blurb:
      "Estudiante de Ingeniería Informática en el Instituto Tecnológico de Buenos Aires.",
  },
  {
    name: "Juan Cruz Rey Labrador",
    role: "Desarrollo",
    blurb:
      "Estudiante de Ingeniería Informática en la Universidad de Buenos Aires.",
  },
];

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function NosotrosPage() {
  return (
    <PageShell
      title="Sobre nosotros"
      intro="Dos personas construyendo una herramienta para los locales que llevan las horas en un cuaderno."
    >
      <Block title="Por qué existe Clockity">
        <p>
          El proyecto surge de un problema con el recuento de horas de una
          empleada doméstica. El conteo se hacía a mano y por mensajes de texto,
          entonces para facilitar y agilizar el proceso decidimos crear esta
          aplicación.
        </p>
        <p>
          El uso de Excel y cuadernos ayudaba, pero no optimizaba del todo el
          recuento, y además nunca era tan preciso como un cronómetro.
        </p>
      </Block>

      <Block title="Quiénes somos">
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {PEOPLE.map((p) => (
            <li
              key={p.name}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <p className="text-sm font-medium text-foreground">{p.name}</p>
              <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                {p.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p.blurb}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Para quién es">
        <List
          items={[
            <>
              Está dirigida a locales o empleadores que le pagan por hora a su
              gente.
            </>,
            <>
              Resuelve el conteo manual de horas para armar el comprobante de
              pago del empleado.
            </>,
            <>
              Solo hace falta un celular o una computadora por persona. Los
              teléfonos personales que ya tienen alcanzan de sobra.
            </>,
          ]}
        />
      </Block>

      <Block title="Cómo se sostiene">
        <p>
          Hoy en día el proyecto lo financiamos nosotros, los desarrolladores.
          Más adelante el servicio va a cobrarse por mes, con un costo que
          dependerá del plan que necesite cada uno, los precios no están definidos todavía.
        </p>
        <p>
          Los datos que cargan los usuarios no se comercializan bajo ningún
          concepto. Si querés leer con más detalle qué hacemos con ellos, entrá
          a nuestra{" "}
          <Link
            href="/privacidad"
            className="font-medium text-foreground underline underline-offset-4"
          >
            política de privacidad
          </Link>
          .
        </p>
      </Block>

      <section className="mt-12">
        <Link
          href="/soporte"
          className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              ¿Querés escribirnos?
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Contesta una persona, no un bot.
            </span>
          </span>
        </Link>
      </section>
    </PageShell>
  );
}
