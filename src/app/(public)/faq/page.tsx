import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageShell } from "../page-shell";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Preguntas frecuentes · Clockity",
  description:
    "Cómo fichar, qué pasa si te olvidás de cerrar un turno, cómo se cargan feriados y cómo se calcula el pago.",
};

/**
 * Built on <details>, not a React accordion: it opens with no JavaScript, the
 * browser handles the keyboard and screen-reader behaviour for free, and
 * Ctrl+F finds text inside a closed item in Chrome. Nothing here needs state.
 */
type Item = { q: string; a: React.ReactNode };

const EMPLEADO: Item[] = [
  {
    q: "¿Cómo ficho mi entrada y mi salida?",
    a: (
      <>
        Entrás a tu grupo y tocás el botón grande de fichar. El cronómetro
        arranca y lo ves correr. Cuando terminás, volvés a entrar y tocás
        fichar la salida. No hay que anotar nada a mano.
      </>
    ),
  },
  {
    q: "Me olvidé de cerrar el turno. ¿Perdí las horas?",
    a: (
      <>
        No. Si al abrir el turno declaraste cuántas horas ibas a trabajar, el
        sistema lo cierra solo cuando se cumple ese tiempo, así no te queda
        corriendo toda la noche. El turno queda esperando la aprobación de tu
        empleador, y vos podés dejarle una nota contando a qué hora te fuiste
        en realidad. Él ajusta la hora antes de aprobarlo.
      </>
    ),
  },
  {
    q: "¿Por qué no puedo corregir yo la hora de mi turno?",
    a: (
      <>
        Es a propósito. Las horas de un turno las corrige únicamente el
        empleador, para que no haya discusión sobre quién tocó qué. Lo que sí
        podés hacer siempre es escribir una nota en el turno explicando lo que
        pasó — esa nota queda guardada y él la ve cuando lo revisa.
      </>
    ),
  },
  {
    q: "Mi turno dice «sin aprobar». ¿Qué significa?",
    a: (
      <>
        Que tu empleador todavía no lo revisó. Es el estado normal de un turno
        recién cerrado. Importa por una razón concreta:{" "}
        <strong className="font-medium text-foreground">
          los turnos sin aprobar no entran en la liquidación
        </strong>
        . Si ves varios acumulados cerca de la fecha de cobro, avisale.
      </>
    ),
  },
  {
    q: "¿La app me rastrea la ubicación?",
    a: (
      <>
        No hay ningún seguimiento continuo: entre una fichada y otra la app no
        registra dónde estás, y no existe forma de activarlo. Lo único que
        puede pasar es que tu empleador active el control de ubicación, y en
        ese caso se te pide la ubicación{" "}
        <strong className="font-medium text-foreground">
          una sola vez, en el momento exacto de fichar
        </strong>
        , para dejar constancia de que estabas en el lugar de trabajo. Tu
        teléfono te va a pedir permiso y vos lo ves cuando pasa.
      </>
    ),
  },
  {
    q: "¿Cómo sé cuántas horas llevo y cuánto es?",
    a: (
      <>
        En tu grupo ves las horas de hoy y tus últimos turnos. El detalle
        completo del período — día por día, con el valor de cada uno y el total
        — lo genera el empleador y te lo puede mandar por WhatsApp o impreso.
      </>
    ),
  },
];

const EMPLEADOR: Item[] = [
  {
    q: "¿Cómo sumo a un empleado?",
    a: (
      <>
        Entrás al grupo, tocás Invitar y le mandás el link que se genera. Ella
        o él lo abre, crea su cuenta y ya queda adentro. No hace falta que vos
        cargues sus datos.
      </>
    ),
  },
  {
    q: "Es feriado y le pago igual, aunque no venga. ¿Cómo lo cargo?",
    a: (
      <>
        Desde la ficha del empleado, en «Agregar día». Elegís el concepto —
        feriado, vacaciones o un día que se olvidó de fichar — ponés las horas
        y queda cargado y aprobado. Un detalle pensado a propósito: un feriado{" "}
        <strong className="font-medium text-foreground">
          paga sus horas pero no suma el viático
        </strong>
        , porque el viático es plata de transporte o comida y ese día no viajó.
      </>
    ),
  },
  {
    q: "Le subí el valor de la hora a mitad de mes. ¿Se recalculan los turnos viejos?",
    a: (
      <>
        Solo si vos querés. Al cambiar la tarifa elegís desde qué fecha rige.
        Los turnos anteriores a esa fecha quedan congelados al valor viejo y
        los posteriores usan el nuevo, así que el mes sale partido en dos
        tramos honestos en vez de recalcularse entero. Y lo que ya pagaste
        nunca se toca.
      </>
    ),
  },
  {
    q: "Se abrió un turno por error. ¿Lo puedo borrar?",
    a: (
      <>
        Sí. La única excepción es un turno que ya esté dentro de un pago
        registrado: ese no se puede borrar, porque el comprobante que le
        entregaste al empleado tiene que seguir cuadrando con los datos. Todo
        borrado queda asentado en el historial.
      </>
    ),
  },
  {
    q: "¿Puedo manejar más de un negocio con la misma cuenta?",
    a: (
      <>
        Sí. Cada negocio es un grupo aparte, con sus empleados, sus roles y sus
        pagos. Una misma persona también puede trabajar en dos grupos
        distintos.
      </>
    ),
  },
  {
    q: "¿Cómo se calcula lo que tengo que pagar?",
    a: (
      <>
        Horas aprobadas por el valor de la hora de cada empleado, más los
        montos fijos que hayas configurado (viáticos, bonos), más o menos los
        ajustes que agregues en el momento. Antes de confirmar ves el desglose
        completo. El total lo recalcula el servidor en ese momento, así que no
        depende de lo que muestre la pantalla, y una vez registrado no se puede
        editar. Si algo salió mal, el pago se elimina y se registra de nuevo.
      </>
    ),
  },
];

const CUENTA: Item[] = [
  {
    q: "Me olvidé la contraseña.",
    a: (
      <>
        Entrá a{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-foreground underline underline-offset-4"
        >
          recuperar contraseña
        </Link>{" "}
        y poné tu email. Te llega un link para elegir una nueva. Sirve una sola
        vez y vence a la hora, así que usalo apenas te llegue.
      </>
    ),
  },
  {
    q: "¿Se puede usar como app en el celular?",
    a: (
      <>
        Sí, y no hace falta bajar nada de ninguna tienda. Abrís Clockity en el
        navegador del teléfono y elegís «Agregar a pantalla de inicio». Queda
        con su ícono como cualquier otra app y se abre en pantalla completa.
      </>
    ),
  },
  {
    q: "¿Cuánto cuesta?",
    a: (
      <>
        Hoy no cuesta nada. Estamos en desarrollo y todavía no hay planes
        pagos. Si en algún momento los hay, lo vas a saber antes de que te
        cobren.
      </>
    ),
  },
];

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {items.map((item) => (
          <details key={item.q} className="group">
            {/* `list-none` hides the marker in Chrome and Firefox; Safari
                draws its own via ::-webkit-details-marker and ignores it, so
                without the second rule the triangle sits next to our chevron. */}
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <PageShell
      title="Preguntas frecuentes"
      intro="Lo que más nos preguntan, de los dos lados del mostrador."
    >
      <Group title="Si fichás horas" items={EMPLEADO} />
      <Group title="Si tenés empleados" items={EMPLEADOR} />
      <Group title="Tu cuenta" items={CUENTA} />

      <div className="mt-12 rounded-xl border border-border bg-surface-muted/40 p-5">
        <p className="text-sm text-muted-foreground">
          ¿No está lo que buscabas?{" "}
          <Link
            href="/soporte"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Escribinos
          </Link>{" "}
          — contesta una persona, no un bot. También podés mandar un mail
          directo a{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </PageShell>
  );
}
