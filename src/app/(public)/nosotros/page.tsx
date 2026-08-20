import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { PageShell, List } from "../page-shell";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Sobre nosotros · Clockity",
  // TODO: reescribir cuando esté el contenido. Se usa en el buscador y en el
  // preview de WhatsApp, así que conviene que diga quiénes somos, no qué hace
  // la app — eso ya lo dice el landing.
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
 *
 * ⚠️ TODO — every string marked below is placeholder. Do not merge to main
 * with this copy: a Sobre nosotros full of lorem is worse than no page.
 */

/** Fill in. `Avatar` falls back to initials, so photos are optional. */
const PEOPLE: { name: string; role: string; blurb: string; avatarUrl?: string }[] =
  [
    {
      // TODO
      name: "Nombre Apellido",
      role: "Producto y desarrollo",
      blurb:
        "Una línea sobre qué hace acá y de dónde viene. Sin cargos inflados: " +
        "en un equipo de dos, «CEO» resta más de lo que suma.",
    },
    {
      // TODO
      name: "Nombre Apellido",
      role: "Desarrollo",
      blurb: "Ídem — concreto y corto, dos renglones alcanzan.",
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
      // TODO: una frase. Qué son y para quién, no un eslogan.
      intro="Somos dos personas construyendo una herramienta para los locales que llevan las horas en un cuaderno."
    >
      <Block title="Por qué existe Clockity">
        {/* TODO: 2 párrafos. El problema concreto que los llevó a construirlo.
            Si salió de un local real, de un familiar, de haber llevado horas a
            mano — contá eso. Es la única sección donde una anécdota verdadera
            gana por goleada. Evitá «nuestra misión es»: contá la situación y
            la misión se entiende sola. */}
        <p>
          Placeholder — el problema concreto que dio origen a la app. Qué se
          hacía antes, qué salía mal y para quién.
        </p>
        <p>
          Placeholder — por qué las herramientas que ya existían no servían para
          este caso.
        </p>
      </Block>

      <Block title="Quiénes somos">
        <p>
          {/* TODO: una línea de contexto antes de las fichas, opcional. */}
          Placeholder — dónde están, desde cuándo trabajan en esto.
        </p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {PEOPLE.map((p) => (
            <li
              key={p.name}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <Avatar name={p.name} src={p.avatarUrl} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.role}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p.blurb}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Para quién es">
        {/* TODO: ajustar. Esta sección es la que más confianza construye, y es
            el mismo movimiento que «Qué NO es Clockity» en los términos:
            acotar gana más de lo que pierde. */}
        <List
          items={[
            <>Placeholder — el tamaño y tipo de local al que le sirve.</>,
            <>Placeholder — la situación típica que resuelve.</>,
            <>Placeholder — qué necesita tener quien lo usa.</>,
          ]}
        />
      </Block>

      <Block title="Para quién no">
        <List
          items={[
            <>
              Placeholder — el caso que explícitamente no cubre. Si tenés RRHH y
              liquidás por convenio, esto no te sirve, y conviene decirlo acá.
            </>,
            <>
              Placeholder — enganchá con{" "}
              <Link
                href="/terminos"
                className="font-medium text-foreground underline underline-offset-4"
              >
                los términos
              </Link>
              , que ya detallan qué no es la app.
            </>,
          ]}
        />
      </Block>

      <Block title="Cómo se sostiene">
        {/* TODO: 1 párrafo. La sección que casi nadie pone y que en una app de
            sueldos es la que más importa: ¿es gratis? ¿van a vender mis datos?
            Aunque hoy la respuesta sea «es gratis y todavía estamos definiendo
            el precio», decirlo gana más de lo que pierde. */}
        <p>
          Placeholder — cómo se financia hoy y qué se piensa cobrar. Si todavía
          no está definido, decilo: la incertidumbre declarada construye más
          confianza que el silencio.
        </p>
        <p>
          Placeholder — qué NO se hace con los datos, enlazando a{" "}
          <Link
            href="/privacidad"
            className="font-medium text-foreground underline underline-offset-4"
          >
            la política de privacidad
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
