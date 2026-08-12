/**
 * Backend error → Spanish, in one place.
 *
 * Every RPC raises bare English strings ('only employers can verify shifts')
 * and Supabase Auth answers in English too ('Invalid login credentials').
 * Server actions used to hand those straight to the UI, so the person who got
 * stuck was the least equipped to read them — the employee on her phone.
 *
 * Rules for adding cases:
 *   - Say what happened AND what to do, in rioplatense.
 *   - Never leak table, column or function names.
 *   - Anything unmapped falls back to a plain sentence, never a raw dump.
 */

/** Codes the app raises on purpose, checked before the generic table. */
const EXACT: Record<string, string> = {
  // Auth / permisos
  "not authenticated": "Tu sesión venció. Volvé a entrar.",
  "not a member of this group": "Ya no formás parte de este grupo.",

  // Fichaje
  "only employees can clock in": "Solo los empleados pueden fichar.",
  "no open shift in this group": "No tenés ningún turno abierto para cerrar.",
  "time entry not found": "No encontramos ese turno.",
  "cannot edit this time entry": "Este turno no es tuyo.",
  "time entry already verified":
    "Este turno ya fue aprobado por tu empleador y no se puede cambiar.",
  "invalid clock out time": "La hora de salida no es válida.",
  "clock_out must be after clock_in":
    "La hora de salida tiene que ser posterior a la de entrada.",
  "cannot verify an open shift":
    "No se puede aprobar un turno que todavía está abierto.",
  "closed/needs_review shift must have a clock_out":
    "Para cerrar el turno hace falta una hora de salida.",
  "shift not found": "No encontramos ese turno.",

  // Días manuales
  DUPLICATE_ENTRY:
    "Ya habías cargado un día con ese concepto para esa fecha. Revisá la lista de días cargados.",
  INVALID_DATE: "Esa fecha está fuera de rango. Revisá el año.",
  INVALID_MINUTES: "Las horas no son válidas.",
  NOT_A_MANUAL_ENTRY:
    "Ese turno lo fichó el empleado, no se puede borrar. Editalo desde Turnos.",
  "entry not found": "No encontramos ese día.",

  // Invitaciones
  "invitation not found": "Ese link de invitación no existe.",
  "invitation already used": "Esa invitación ya fue usada.",
  "invitation expired": "Esa invitación venció. Pedile una nueva al empleador.",
  "already a member of this group": "Ya sos parte de este grupo.",
  "position only applies to employee invitations":
    "El rol solo se puede asignar a invitaciones de empleado.",

  // Perfil / miembros
  "profile not found": "Este empleado todavía no tiene perfil configurado.",
  "member not found": "No encontramos a ese miembro.",
  "only employee members have a profile":
    "Solo los empleados tienen perfil de pago.",
  "display name cannot be empty": "El nombre no puede quedar vacío.",
  "avatar_url must be an http(s) URL": "La foto no se pudo guardar.",

  // Pagos y tarifas
  "period_end must be after period_start":
    "La fecha de fin tiene que ser posterior a la de inicio.",
  "adjustment amount required": "Cada ajuste necesita un monto.",
  "new_rate must be >= 0": "La tarifa no puede ser negativa.",
  "effective_from is required": "Elegí desde cuándo se aplica la tarifa nueva.",

  // Roles
  "position not found": "No encontramos ese rol.",
  "position does not belong to this group": "Ese rol es de otro grupo.",
  "group name is required": "Poné un nombre para el grupo.",

  // Geofence
  "lat/lng/radius required when enabling geofence":
    "Para activar la ubicación hace falta marcar el lugar y el radio.",
  "radius must be between 10 m and 100 km":
    "El radio tiene que estar entre 10 metros y 100 km.",
  "invalid latitude": "La ubicación no es válida.",
  "invalid longitude": "La ubicación no es válida.",

  // Supabase Auth (llegan en inglés desde el servicio)
  "Invalid login credentials": "El email o la contraseña no coinciden.",
  "Email not confirmed":
    "Todavía no confirmaste tu email. Buscá el mail que te mandamos.",
  "User already registered": "Ya existe una cuenta con ese email.",
  "Email rate limit exceeded":
    "Probaste demasiadas veces. Esperá unos minutos.",
};

/** Fragmentos: para mensajes con partes variables o de Postgres. */
const CONTAINS: [string, string][] = [
  // Cualquier "only employers can X"
  ["only employers can", "Esto solo lo puede hacer el empleador."],
  // Constraint de 0022: dos pagos que se pisan
  [
    "payments_no_overlap",
    "Ya existe un pago que cubre parte de ese período. Revisá los pagos anteriores.",
  ],
  ["one_open_shift_per_profile", "Ya tenés un turno abierto."],
  ["duplicate key", "Ese dato ya existe."],
  ["Password should be at least", "La contraseña es demasiado corta."],
  ["rate limit", "Probaste demasiadas veces. Esperá unos minutos."],
  ["Failed to fetch", "No pudimos conectarnos. Revisá tu internet."],
  ["fetch failed", "No pudimos conectarnos. Revisá tu internet."],
  // PostgREST when an RPC does not exist (PGRST202). Migrations here are
  // applied by hand, so "the function is missing" is a routine state, and
  // "probá de nuevo" sends you to retry something that can never work. Say
  // what it actually is instead — the person reading this owns the database.
  [
    "in the schema cache",
    "Falta aplicar una migración en Supabase: esta acción usa una función que todavía no existe en la base. Corré el último archivo de supabase/migrations y reintentá.",
  ],
  [
    "Could not find the function",
    "Falta aplicar una migración en Supabase: esta acción usa una función que todavía no existe en la base. Corré el último archivo de supabase/migrations y reintentá.",
  ],
];

/**
 * Translates a backend error for display.
 *
 * @param fallback what to say when nothing matches — write it for the specific
 *   screen ("No pudimos guardar el turno, probá de nuevo") rather than relying
 *   on the generic default.
 */
export function friendlyError(
  raw: string | null | undefined,
  fallback = "No pudimos completar la acción. Probá de nuevo.",
): string {
  const message = (raw ?? "").trim();
  if (message === "") return fallback;

  if (EXACT[message]) return EXACT[message];

  // POSITION_IN_USE:3 → cuántos empleados lo están usando
  const inUse = message.match(/POSITION_IN_USE:(\d+)/);
  if (inUse) {
    const n = Number(inUse[1]);
    return n === 1
      ? "No podés eliminar este rol: hay 1 empleado que lo tiene asignado."
      : `No podés eliminar este rol: hay ${n} empleados que lo tienen asignado.`;
  }

  for (const [needle, text] of CONTAINS) {
    if (message.includes(needle)) return text;
  }

  return fallback;
}
