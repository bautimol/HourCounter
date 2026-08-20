import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Section, List } from "../page-shell";
import { SUPPORT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/support";

export const metadata: Metadata = {
  title: "Términos y condiciones · Clockity",
  description:
    "Las condiciones de uso de Clockity, en castellano y sin letra chica.",
};

/**
 * Written to be read, not to be survived. The section that actually matters is
 * "Qué no es Clockity": the target market is informal work, so the app must
 * never be mistaken for payroll registration or for compliance with anything.
 */
export default function TerminosPage() {
  return (
    <PageShell
      title="Términos y condiciones"
      intro="En castellano y sin letra chica. Si algo no se entiende, escribinos y lo aclaramos."
      meta={`Última actualización: ${LEGAL_LAST_UPDATED}`}
    >
      <Section title="1. Qué es Clockity">
        <p>
          Clockity es una herramienta para registrar horas trabajadas y calcular
          cuánto corresponde pagar por ellas. Un empleador crea un grupo, define
          cuánto vale la hora y qué montos fijos hay, invita a sus empleados, y
          ellos fichan entrada y salida desde su teléfono. La app suma las horas
          y muestra el total.
        </p>
        <p>
          Usar Clockity significa aceptar estos términos. Si no estás de acuerdo
          con algo de acá, no lo uses.
        </p>
      </Section>

      <Section title="2. Qué NO es Clockity">
        <p>
          Esto es lo más importante de esta página, así que va antes que el
          resto:
        </p>
        <List
          items={[
            <>
              <strong className="font-medium text-foreground">
                No es un recibo de sueldo ni reemplaza uno.
              </strong>{" "}
              Los comprobantes que la app imprime son un resumen de lo
              registrado entre dos personas, no un documento laboral.
            </>,
            <>
              <strong className="font-medium text-foreground">
                No registra la relación laboral ante ningún organismo.
              </strong>{" "}
              Usar Clockity no da de alta a nadie, no aporta a ARCA (ex AFIP),
              ni a la seguridad social, ni a ninguna obra social o sindicato.
            </>,
            <>
              <strong className="font-medium text-foreground">
                No verifica que lo que cobrás sea legal.
              </strong>{" "}
              El valor de la hora lo pone el empleador. La app no lo compara
              contra convenios, salarios mínimos ni escalas de ningún tipo.
            </>,
            <>
              <strong className="font-medium text-foreground">
                No es asesoramiento legal, contable ni impositivo.
              </strong>
            </>,
          ]}
        />
        <p>
          Cumplir con las obligaciones laborales que correspondan es
          responsabilidad del empleador, con o sin Clockity de por medio.
        </p>
      </Section>

      <Section title="3. Tu cuenta">
        <p>
          Necesitás una cuenta para usar la app. Tenés que dar datos reales,
          cuidar tu contraseña y avisarnos si creés que alguien más entró a tu
          cuenta. Todo lo que se haga desde tu cuenta se considera hecho por
          vos.
        </p>
        <p>
          Las cuentas son personales. No compartas la tuya: si dos personas
          entran con el mismo usuario, el historial deja de servir justamente
          para lo que existe, que es saber quién hizo qué.
        </p>
      </Section>

      <Section title="4. Los dos roles y qué puede cada uno">
        <p>
          Dentro de un grupo hay empleadores y empleados, y no pueden lo mismo:
        </p>
        <List
          items={[
            <>
              El <strong className="font-medium text-foreground">empleado</strong>{" "}
              ficha sus turnos y puede escribir notas. No puede modificar las
              horas registradas ni aprobar nada.
            </>,
            <>
              El{" "}
              <strong className="font-medium text-foreground">empleador</strong>{" "}
              define tarifas, corrige y aprueba turnos, carga días que no se
              ficharon (feriados, vacaciones) y registra los pagos.
            </>,
          ]}
        />
        <p>
          El empleador es el responsable de que los datos que carga sean
          correctos y de la relación laboral con las personas que invita.
          Nosotros no somos parte de esa relación ni mediamos en ella.
        </p>
      </Section>

      <Section title="5. Uso aceptable">
        <p>No se puede usar Clockity para:</p>
        <List
          items={[
            "Cargar datos de personas que no saben que están siendo registradas.",
            "Intentar entrar a grupos, cuentas o datos que no son tuyos.",
            "Sobrecargar, romper o probar la seguridad del servicio sin avisarnos antes.",
            "Cualquier cosa ilegal, o para acosar o perjudicar a otra persona.",
          ]}
        />
        <p>
          Si pasa algo de esto podemos suspender o cerrar la cuenta, y si hay
          gente afectada vamos a intentar avisarle.
        </p>
      </Section>

      <Section title="6. El servicio está en desarrollo">
        <p>
          Clockity funciona y hay gente usándolo todos los días, pero es un
          proyecto joven y lo decimos de frente: puede tener errores, puede
          estar caído un rato, y puede cambiar de un día para el otro.
        </p>
        <p>
          Se presta «tal como está». No garantizamos que esté siempre
          disponible ni que esté libre de fallas. Dentro de lo que la ley
          permite, no nos hacemos responsables por pérdidas derivadas de usarlo
          — pero eso no es una excusa: si un número sale mal por culpa nuestra,
          queremos enterarnos y arreglarlo.
        </p>
        <p>
          Consejo práctico y honesto: si el registro de horas es la única
          prueba de lo que se le pagó a alguien, guardá también los
          comprobantes impresos.
        </p>
      </Section>

      <Section title="7. Precio">
        <p>
          Hoy Clockity es gratis. Si en algún momento hay planes pagos, lo
          vamos a avisar con anticipación y nunca se va a cobrar nada sin que
          lo aceptes antes.
        </p>
      </Section>

      <Section title="8. Tus datos">
        <p>
          Cómo se tratan los datos está explicado en la{" "}
          <Link
            href="/privacidad"
            className="font-medium text-foreground underline underline-offset-4"
          >
            política de privacidad
          </Link>
          , que es parte de estos términos. Ahí está el detalle de qué se
          guarda, quién lo ve y cómo pedir que se borre.
        </p>
      </Section>

      <Section title="9. Dar de baja la cuenta">
        <p>
          Podés irte cuando quieras escribiéndonos a {SUPPORT_EMAIL}. Tené en
          cuenta una cosa: los pagos ya registrados son el respaldo de lo que
          se cobró, así que cuando alguien se va de un grupo su historial se
          archiva en vez de borrarse. Si querés que se elimine, decilo
          explícitamente y hablamos con el empleador del grupo, porque también
          es su registro.
        </p>
      </Section>

      <Section title="10. Cambios en estos términos">
        <p>
          Si cambian, actualizamos la fecha de arriba. Si el cambio es
          importante, además lo avisamos dentro de la app. Seguir usándola
          después de eso significa aceptarlo.
        </p>
      </Section>

      <Section title="11. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Ante
          cualquier conflicto, primero escribinos: casi todo se resuelve
          hablando antes que en un tribunal.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Dudas sobre esta página:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </PageShell>
  );
}
