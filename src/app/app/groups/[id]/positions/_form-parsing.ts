/**
 * Shared parsing helpers for the position form, used by both the create and
 * update server actions. The form posts position scalar fields plus four
 * parallel arrays (one entry per fixed-amount row).
 */

export const PAYMENT_PERIODS = [
  "weekly",
  "biweekly",
  "monthly",
  "custom_days",
] as const;
export type PaymentPeriod = (typeof PAYMENT_PERIODS)[number];

export const FIXED_FREQUENCIES = [
  "per_period",
  "per_day_worked",
  "every_n_days",
  "one_shot",
] as const;
export type FixedFrequency = (typeof FIXED_FREQUENCIES)[number];

export type ParsedPosition = {
  name: string;
  hourlyRate: number;
  paymentPeriod: PaymentPeriod;
  customPeriodDays: number | null;
  currency: string;
  fixedAmounts: {
    description: string;
    amount: number;
    frequency: FixedFrequency;
    custom_days: number | null;
  }[];
};

export type ParseResult =
  | { ok: true; value: ParsedPosition }
  | { ok: false; error: string };

export function parsePositionForm(formData: FormData): ParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const hourlyRateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const paymentPeriod = String(formData.get("payment_period") ?? "");
  const customDaysRaw = String(
    formData.get("custom_period_days") ?? "",
  ).trim();
  const currency =
    String(formData.get("currency") ?? "ARS").trim().toUpperCase() || "ARS";

  if (!name) return { ok: false, error: "El nombre es obligatorio" };

  const hourlyRate = Number(hourlyRateRaw);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return { ok: false, error: "Tarifa por hora inválida" };
  }

  if (!PAYMENT_PERIODS.includes(paymentPeriod as PaymentPeriod)) {
    return { ok: false, error: "Período de pago inválido" };
  }

  let customPeriodDays: number | null = null;
  if (paymentPeriod === "custom_days") {
    customPeriodDays = Number(customDaysRaw);
    if (!Number.isInteger(customPeriodDays) || customPeriodDays <= 0) {
      return { ok: false, error: "Cantidad de días inválida" };
    }
  }

  const descriptions = formData.getAll("fixed_description").map(String);
  const amounts = formData.getAll("fixed_amount").map(String);
  const frequencies = formData.getAll("fixed_frequency").map(String);
  const customDaysList = formData.getAll("fixed_custom_days").map(String);

  if (
    descriptions.length !== amounts.length ||
    descriptions.length !== frequencies.length ||
    descriptions.length !== customDaysList.length
  ) {
    return { ok: false, error: "Datos de montos fijos inconsistentes" };
  }

  const fixedAmounts: ParsedPosition["fixedAmounts"] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]!.trim();
    if (!desc) continue;
    const amt = Number(amounts[i]);
    const freq = frequencies[i] as FixedFrequency;
    if (!Number.isFinite(amt)) {
      return { ok: false, error: `Monto inválido en "${desc}"` };
    }
    if (!FIXED_FREQUENCIES.includes(freq)) {
      return { ok: false, error: `Frecuencia inválida en "${desc}"` };
    }

    let cd: number | null = null;
    if (freq === "every_n_days") {
      const raw = customDaysList[i]!.trim();
      cd = Number(raw);
      if (!Number.isInteger(cd) || cd <= 0) {
        return { ok: false, error: `Cantidad de días inválida en "${desc}"` };
      }
    }

    fixedAmounts.push({
      description: desc,
      amount: amt,
      frequency: freq,
      custom_days: cd,
    });
  }

  return {
    ok: true,
    value: {
      name,
      hourlyRate,
      paymentPeriod: paymentPeriod as PaymentPeriod,
      customPeriodDays,
      currency,
      fixedAmounts,
    },
  };
}
