/**
 * Display helpers for HourCounter domain values.
 */

/**
 * App-wide display timezone. The product is Argentina-only, and the server
 * (Vercel) runs in UTC — without pinning this, every server-rendered date/time
 * comes out +3h (a 09:00 shift shows as 12:00). Argentina has no DST (UTC-3
 * year-round since 2009), so a fixed zone is safe.
 */
export const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function paymentPeriodLabel(
  period: string | null | undefined,
  customDays?: number | null,
): string {
  switch (period) {
    case "weekly":
      return "Semanal";
    case "biweekly":
      return "Quincenal";
    case "monthly":
      return "Mensual";
    case "custom_days":
      return customDays ? `Cada ${customDays} días` : "Personalizado";
    default:
      return "—";
  }
}

export function fixedAmountFrequencyLabel(
  freq: string | null | undefined,
  customDays?: number | null,
): string {
  switch (freq) {
    case "per_period":
      return "Por período";
    case "per_day_worked":
      return "Por día trabajado";
    case "every_n_days":
      return customDays ? `Cada ${customDays} días` : "Cada N días";
    case "one_shot":
      return "Único";
    default:
      return "—";
  }
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "ARS",
): string {
  const value = typeof amount === "string" ? Number(amount) : amount ?? 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * "3h 12m" / "12m" / "0m" — pads minutes when hours present.
 * Negative durations render as "0m" (defensive — should never happen).
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

/**
 * "3:12:45" — for the live ticking timer of an open shift.
 */
export function formatStopwatch(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * "9:30" — local time of day, no seconds.
 */
export function formatTimeOfDay(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TIME_ZONE,
  }).format(date);
}

/**
 * "lun 4 may" — short date for shift listings.
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: AR_TIME_ZONE,
  }).format(date);
}

/**
 * Returns the UTC instant of "today at 00:00 in Argentina", for "hours worked
 * today" queries. The old `new Date().setHours(0,0,0,0)` used the *server's*
 * local midnight — on Vercel (UTC) that is 21:00 ART the day before, so "today"
 * started 3h early. We resolve the current Y-M-D in AR and pin midnight to
 * 03:00 UTC (= 00:00 ART, UTC-3 with no DST).
 */
export function startOfTodayIso(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T03:00:00.000Z`;
}
