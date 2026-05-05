"use client";

import { motion } from "motion/react";
import {
  Briefcase,
  Clock,
  Coins,
  Smartphone,
  TimerReset,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Clock className="h-5 w-5" aria-hidden />,
    title: "Clock in / out con cronómetro",
    body: "El empleado abre su turno con una toca, ve el cronómetro corriendo y cierra cuando termina. Si declara las horas estimadas, el sistema cierra solo si se olvidó.",
  },
  {
    icon: <Briefcase className="h-5 w-5" aria-hidden />,
    title: "Roles configurables",
    body: "Definí 'Cajero', 'Cocinero', 'Repartidor' una vez con tarifa y montos fijos. Los nuevos empleados heredan todo. Si subís la tarifa del rol, se actualiza en todos automáticamente.",
  },
  {
    icon: <Users className="h-5 w-5" aria-hidden />,
    title: "Multi-empleador",
    body: "Una persona puede ser empleado en un grupo y empleador en otro. Los grupos son espacios de trabajo independientes con sus propios miembros, roles y períodos.",
  },
  {
    icon: <Coins className="h-5 w-5" aria-hidden />,
    title: "Pagos al día",
    body: "Al momento de pagar ya sabés cuánto. Horas × tarifa + viáticos del período + ajustes one-shot, todo calculado. Se acabó hacer la cuenta a mano cada vez.",
  },
  {
    icon: <TimerReset className="h-5 w-5" aria-hidden />,
    title: "Overrides por persona",
    body: "Tu cajero senior cobra más que el resto sin tener que duplicar el rol. Pisás los campos que querés caso a caso, los demás siguen heredando del rol.",
  },
  {
    icon: <Smartphone className="h-5 w-5" aria-hidden />,
    title: "Funciona desde el celular",
    body: "Web app instalable. El empleado ficha desde su teléfono, vos verificás desde la compu o el celular según dónde estés.",
  },
];

export function FeaturesGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <motion.li
          key={f.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, delay: i * 0.06 }}
          className="group relative rounded-2xl border border-border bg-surface/70 p-5 shadow-sm shadow-black/5 backdrop-blur-sm transition-colors hover:border-border-strong"
        >
          <div className="mb-3 inline-flex items-center justify-center rounded-xl bg-accent-soft p-2.5 text-accent-soft-foreground">
            {f.icon}
          </div>
          <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
        </motion.li>
      ))}
    </ul>
  );
}
