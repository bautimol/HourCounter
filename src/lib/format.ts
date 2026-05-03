/**
 * Display helpers for HourCounter domain values.
 */

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
