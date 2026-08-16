import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageShell, Section, List } from "../page-shell";
import { SUPPORT_EMAIL, supportMailto, LEGAL_LAST_UPDATED } from "@/lib/support";

export const metadata: Metadata = {
  title: "Política de privacidad · Clockity",
  description:
    "Qué datos guarda Clockity, quién los ve, con quién se comparten y cómo pedir que se borren.",
};

/**
 * Written against the actual schema rather than from a template. Two things
 * here are disclosed because they would otherwise be surprises: clock-in
 * coordinates are stored when the employer turns the geofence on, and the
 * employer's notes about an employee are invisible to that employee. A privacy
 * policy that omits the uncomfortable parts is the only kind worth nothing.
 */
export default function PrivacidadPage() {
  return (
    <PageShell
      title="Política de privacidad"
      intro="Qué guardamos, por qué, quién lo ve y cómo pedir que se borre."
      meta={`Última actualización: ${LEGAL_LAST_UPDATED}`}
    >
      <Section title="Lo corto">
        <p>
          Guardamos lo mínimo para que la app haga lo que promete: registrar
          horas y calcular pagos.{" "}
          <strong className="font-medium text-foreground">
            No vendemos datos, no hay publicidad y no hay rastreadores de
            terceros.
          </strong>{" "}
          La única cookie que ponemos es la que te mantiene con la sesión
          abierta — por eso tampoco vas a ver un cartel de cookies.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <p>
          <strong className="font-medium text-foreground">De tu cuenta:</strong>{" "}
          tu email y tu contraseña, que se guarda cifrada y que nadie —
          nosotros incluidos — puede leer. Si entrás con Google, además el
          nombre y la foto que Google nos comparte. Tu nombre para mostrar y,
          si subís una, tu foto de perfil.
        </p>
        <p>
          <strong className="font-medium text-foreground">De tu trabajo:</strong>{" "}
          la fecha y hora de cada entrada y salida, las notas que se escriban
          en un turno, si el turno lo fichó el empleado o lo cargó el empleador
          a mano, y de qué tipo es (trabajado, feriado, vacaciones). También el
          valor de la hora, los montos fijos configurados, y los pagos
          registrados con sus períodos, totales y ajustes.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            El historial de cambios:
          </strong>{" "}
          cada vez que alguien modifica, aprueba o borra un turno queda
          registrado quién fue y cuándo. Existe para que una discusión sobre
          horas tenga una respuesta, y por eso no se puede desactivar.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Si activás las notificaciones:
          </strong>{" "}
          el identificador que genera tu navegador para poder enviártelas, y
          qué navegador es.
        </p>
        <p>
          <strong className="font-medium text-foreground">De uso:</strong>{" "}
          cuántas visitas recibe cada página. Es anónimo, no usa cookies y no
          se puede vincular con vos.
        </p>
      </Section>

      <Section title="Ubicación: cuándo sí y cuándo no">
        <div className="rounded-xl border border-border bg-surface-muted/40 p-5">
          <div className="flex items-start gap-3">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="space-y-3">
              <p>
                <strong className="font-medium text-foreground">
                  No hay seguimiento continuo, y no existe una función para
                  activarlo.
                </strong>{" "}
                Entre una fichada y otra la app no sabe dónde estás.
              </p>
              <p>
                Lo único que puede ocurrir es que el empleador active el control
                de ubicación para su grupo. En ese caso, y solo en el momento
                exacto de fichar, el navegador pide permiso y se guardan las
                coordenadas de ese instante junto con si estaban dentro del
                radio que el empleador definió. El teléfono siempre pide
                permiso: si lo negás, no se guarda nada.
              </p>
              <p>
                Esa coordenada queda asociada a ese turno y la ve el empleador
                del grupo.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Quién ve qué">
        <List
          items={[
            <>
              <strong className="font-medium text-foreground">
                Tu empleador
              </strong>{" "}
              ve tus turnos, tus horas, tu tarifa, tus pagos y —si está
              activada— la ubicación de tus fichadas.
            </>,
            <>
              <strong className="font-medium text-foreground">
                Los demás miembros del grupo
              </strong>{" "}
              ven tu nombre, tu foto y si estás trabajando en este momento. No
              ven tu tarifa ni tus pagos.
            </>,
            <>
              <strong className="font-medium text-foreground">
                Las notas que el empleador escribe sobre un empleado no son
                visibles para ese empleado.
              </strong>{" "}
              Lo decimos acá porque es el tipo de cosa que se descubre en el
              peor momento. Los apodos que cada uno pone son privados de quien
              los puso.
            </>,
            <>
              <strong className="font-medium text-foreground">Nosotros</strong>{" "}
              podemos acceder a la base de datos para dar soporte, arreglar
              errores y mantener el servicio. No la miramos por curiosidad y no
              la usamos para otra cosa.
            </>,
          ]}
        />
      </Section>

      <Section title="Con quién se comparten">
        <p>
          Con nadie que no sea necesario para que la app funcione. Los
          proveedores que intervienen son:
        </p>
        <List
          items={[
            <>
              <strong className="font-medium text-foreground">Supabase</strong>{" "}
              — guarda la base de datos y las cuentas. Los servidores están en
              São Paulo, Brasil.
            </>,
            <>
              <strong className="font-medium text-foreground">Vercel</strong> —
              sirve la aplicación, también desde São Paulo, y cuenta las
              visitas de forma anónima.
            </>,
            <>
              <strong className="font-medium text-foreground">Google</strong> —
              únicamente si elegís entrar con tu cuenta de Google.
            </>,
            <>
              <strong className="font-medium text-foreground">
                El servicio de notificaciones de tu navegador
              </strong>{" "}
              (Google, Apple o Mozilla, según cuál uses) — solo si activaste las
              notificaciones, y solo para entregarlas.
            </>,
          ]}
        />
        <p>
          Como los servidores están en Brasil, tus datos se procesan fuera de
          Argentina. Nada se vende ni se cede a terceros con fines comerciales.
        </p>
      </Section>

      <Section title="Cuánto tiempo se guardan">
        <p>
          Mientras tengas cuenta. Cuando alguien deja un grupo, su información
          se archiva en lugar de borrarse: los turnos y pagos son el respaldo de
          lo que se cobró, y borrarlos dejaría al empleado sin prueba tanto como
          al empleador. Si querés que se elimine igual, pedilo y lo hablamos.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Por la Ley 25.326 de Protección de los Datos Personales tenés derecho
          a saber qué datos tuyos tenemos, a corregirlos si están mal, a
          actualizarlos y a pedir que se supriman.
        </p>
        <p>
          Se ejercen escribiendo a{" "}
          <a
            href={supportMailto("Datos personales")}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          desde la casilla de tu cuenta. Es gratis y contestamos dentro de los
          plazos que fija la ley. Varias cosas las podés hacer vos mismo sin
          pedirnos nada: cambiar tu nombre y tu foto desde tu perfil, y
          desactivar las notificaciones desde ahí mismo.
        </p>
        <p>
          Si considerás que no atendimos bien tu reclamo, podés presentarlo ante
          la Agencia de Acceso a la Información Pública, que es el organismo de
          control en Argentina.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          Todo viaja cifrado, las contraseñas se guardan hasheadas y los
          permisos se aplican en la base de datos misma, no solo en la
          pantalla: aunque alguien intentara consultar los datos por fuera de
          la app, la base le devuelve únicamente lo que esa persona puede ver.
        </p>
        <p>
          Ningún sistema es infalible. Si detectamos un incidente que afecte
          tus datos, te lo vamos a avisar.
        </p>
      </Section>

      <Section title="Cambios">
        <p>
          Si cambiamos esta política actualizamos la fecha de arriba, y si el
          cambio afecta lo que hacemos con tus datos lo avisamos dentro de la
          app. Las condiciones generales están en los{" "}
          <Link
            href="/terminos"
            className="font-medium text-foreground underline underline-offset-4"
          >
            términos y condiciones
          </Link>
          .
        </p>
      </Section>
    </PageShell>
  );
}
