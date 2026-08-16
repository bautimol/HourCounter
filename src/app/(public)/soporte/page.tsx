import type { Metadata } from "next";
import Link from "next/link";
import { Mail, HelpCircle, KeyRound } from "lucide-react";
import { PageShell } from "../page-shell";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";

export const metadata: Metadata = {
  title: "Soporte · Clockity",
  description: "Escribinos si algo no anda o si tenés una duda con Clockity.",
};

/**
 * Deliberately not a contact form. A form needs a backend, a spam defence and
 * somewhere to put the messages; a mailto needs none of that and gives the
 * person a copy of what they sent in their own outbox — which matters when the
 * thing they are writing about is how much they got paid.
 */
export default function SoportePage() {
  return (
    <PageShell
      title="Soporte"
      intro="Somos dos personas construyendo esto. Escribinos y contestamos lo antes que podamos."
    >
      <div className="space-y-4">
        <a
          href={supportMailto(
            "Consulta sobre Clockity",
            "Contanos qué pasó:\n\n\n" +
              "— Si fue en un turno o en un pago, decinos la fecha.\n" +
              "— Si te apareció un mensaje de error, copialo tal cual.\n" +
              "— Desde qué usás Clockity: celular o computadora.\n",
          )}
          className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              Escribinos por mail
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {SUPPORT_EMAIL} — se abre con el asunto puesto y unas preguntas
              para que no tengas que adivinar qué contarnos.
            </span>
          </span>
        </a>

        <Link
          href="/faq"
          className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
            <HelpCircle className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              Mirá primero las preguntas frecuentes
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Turnos que quedan sin aprobar, feriados, cambios de tarifa a
              mitad de mes. Probablemente ya esté resuelto ahí.
            </span>
          </span>
        </Link>

        <Link
          href="/forgot-password"
          className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
            <KeyRound className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              No puedo entrar a mi cuenta
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Si te olvidaste la contraseña, esto lo resolvés solo y en un
              minuto, sin esperar respuesta.
            </span>
          </span>
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          Si el problema es con la plata
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Clockity registra lo que se fichó y calcula sobre eso, pero{" "}
          <strong className="font-medium text-foreground">
            no decide cuánto se cobra
          </strong>{" "}
          — el valor de la hora, los montos fijos y las correcciones de turnos
          los define el empleador. Si un total no te cierra, lo primero es
          hablarlo con él: en el detalle del período se ve día por día de dónde
          sale cada peso. Si lo que no cierra es un número que la app calculó
          mal, eso sí es un problema nuestro y queremos saberlo.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          Si encontraste un problema de seguridad
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Escribinos a{" "}
          <a
            href={supportMailto("Seguridad")}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          con el asunto «Seguridad» y contanos qué encontraste antes de
          publicarlo. Acá hay datos de personas reales y sueldos de gente que
          los necesita.
        </p>
      </section>
    </PageShell>
  );
}
