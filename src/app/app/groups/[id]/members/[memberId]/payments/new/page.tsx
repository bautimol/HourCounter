import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  AR_TIME_ZONE,
  conceptShortLabel,
  fixedAmountFrequencyLabel,
  formatCurrency,
  formatHours,
} from "@/lib/format";
import { PaymentDraftForm } from "./payment-draft-form";

type PayDraft = {
  profile_id: string;
  period_start: string;
  period_end: string;
  days_in_period: number;
  hourly_rate: number;
  currency: string;
  shift_count: number;
  days_with_shifts: number;
  hours_worked: number;
  hourly_amount: number;
  /** True when the period spans an effective-dated rate change. */
  mixed_rates?: boolean;
  /** Hours split by what the day IS (worked / feriado / vacaciones / otro). */
  by_concept?: {
    concept: string;
    entries: number;
    hours: number;
    amount: number;
  }[];
  fixed_amounts: {
    id: string;
    description: string;
    frequency: string;
    custom_days: number | null;
    amount_each: number;
    times_applied: number;
    subtotal: number;
  }[];
  fixed_amounts_total: number;
  subtotal: number;
};

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; memberId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id, memberId } = await params;
  const { from: fromParam, to: toParam } = await searchParams;

  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!myMembership || myMembership.role !== "employer") {
    redirect(`/app/groups/${id}`);
  }

  const { data: member } = await supabase
    .from("group_members")
    .select("id, role, display_name, avatar_url, group_id")
    .eq("id", memberId)
    .eq("group_id", id)
    .maybeSingle();

  if (!member) notFound();
  if (member.role !== "employee") {
    redirect(`/app/groups/${id}/members/${memberId}`);
  }

  const { data: profile } = await supabase
    .from("employee_profiles")
    .select("id")
    .eq("group_member_id", memberId)
    .maybeSingle();

  if (!profile) {
    // No profile = nothing to pay. Send the employer to configure first.
    redirect(`/app/groups/${id}/members/${memberId}/edit`);
  }

  // Default period: from the most recent payment for this profile (+1ms),
  // or from the very first verified shift if no previous payment.
  // Default end: now.
  const now = new Date();

  let defaultFromIso: string;
  if (fromParam) {
    defaultFromIso = fromParam;
  } else {
    const { data: lastPayment } = await supabase
      .from("payments")
      .select("period_end")
      .eq("employee_profile_id", profile.id)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPayment?.period_end) {
      defaultFromIso = lastPayment.period_end;
    } else {
      const { data: firstShift } = await supabase
        .from("time_entries")
        .select("clock_in")
        .eq("employee_profile_id", profile.id)
        .not("verified_at", "is", null)
        .order("clock_in", { ascending: true })
        .limit(1)
        .maybeSingle();

      defaultFromIso =
        firstShift?.clock_in ??
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const defaultToIso = toParam ?? now.toISOString();

  // Compute the draft via RPC.
  const { data: draftData, error: draftError } = await supabase.rpc(
    "calculate_pay_draft",
    {
      target_profile_id: profile.id,
      period_start_iso: defaultFromIso,
      period_end_iso: defaultToIso,
    },
  );

  const draft = draftData as unknown as PayDraft | null;
  const memberName = member.display_name ?? "Empleado";

  // Shifts inside this period that were never approved. The draft ignores them
  // (it only counts verified ones), and once this payment exists the
  // payments_no_overlap constraint blocks re-liquidating the same range — so
  // approving them afterwards would strand those hours, unpaid and unnoticed.
  const { data: pendingRows } = await supabase
    .from("time_entries")
    .select("id, clock_in, clock_out")
    .eq("employee_profile_id", profile.id)
    .is("verified_at", null)
    .not("clock_out", "is", null)
    .gte("clock_in", defaultFromIso)
    .lt("clock_in", defaultToIso);

  const pendingShifts = pendingRows ?? [];
  const pendingMinutes = pendingShifts.reduce((acc, s) => {
    if (!s.clock_out) return acc;
    return (
      acc +
      (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60000
    );
  }, 0);
  const pendingHours = pendingMinutes / 60;
  const pendingAmount = pendingHours * (draft?.hourly_rate ?? 0);

  // Only worth splitting when the period actually mixes concepts: with a lone
  // "worked" bucket the sub-lines would just repeat the total.
  const byConcept = draft?.by_concept ?? [];
  const showConceptBreakdown = byConcept.length > 1;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          {
            label: memberName,
            href: `/app/groups/${id}/members/${memberId}`,
          },
          { label: "Nuevo pago" },
        ]}
        title={`Liquidar pago — ${memberName}`}
        subtitle="Resumen calculado a partir de las horas verificadas y los montos fijos. Agregá ajustes one-shot si hace falta y confirmá."
        icon={<Coins className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardHeader className="flex items-center gap-3">
          <Avatar
            name={memberName}
            src={member.avatar_url}
            size="md"
          />
          <div>
            <CardTitle>{memberName}</CardTitle>
            <p className="text-xs text-muted-foreground tabular-nums">
              Período:{" "}
              {new Date(defaultFromIso).toLocaleString("es-AR", {
                timeZone: AR_TIME_ZONE,
              })}
              {" → "}
              {new Date(defaultToIso).toLocaleString("es-AR", {
                timeZone: AR_TIME_ZONE,
              })}
            </p>
          </div>
        </CardHeader>
      </Card>

      {draftError && (
        <Card className="border-danger/40">
          <p className="px-5 py-4 text-sm text-danger">
            Error calculando el pago: {draftError.message}
          </p>
        </Card>
      )}

      {draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Cálculo</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="divide-y divide-border text-sm">
                <li className="py-2.5 first:pt-0">
                  <div className="flex items-baseline justify-between">
                    <span>
                      {/* With feriados or vacaciones inside, the total is no
                          longer "horas trabajadas" — and days_with_shifts only
                          counts genuinely worked days. */}
                      {showConceptBreakdown ? "Horas pagadas" : "Horas trabajadas"}{" "}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ({draft.shift_count} turnos · {draft.days_with_shifts}{" "}
                        {showConceptBreakdown ? "días trabajados" : "días"})
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">
                      {draft.hours_worked.toLocaleString("es-AR")} h
                    </span>
                  </div>
                  {showConceptBreakdown && (
                    <ul className="mt-2 space-y-1 border-l border-border pl-3">
                      {byConcept.map((c) => (
                        <li
                          key={c.concept}
                          className="flex items-baseline justify-between text-xs text-muted-foreground"
                        >
                          <span>{conceptShortLabel(c.concept)}</span>
                          <span className="tabular-nums">
                            {formatHours(c.hours)} h
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
                <li className="py-2.5">
                  <div className="flex items-baseline justify-between">
                    <span>
                      Tarifa por hora{" "}
                      <span className="text-xs text-muted-foreground">
                        {draft.mixed_rates
                          ? "(varias según fecha)"
                          : "(efectiva)"}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {draft.mixed_rates
                        ? "—"
                        : formatCurrency(draft.hourly_rate, draft.currency)}
                    </span>
                  </div>
                  {draft.mixed_rates && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      En este período hubo más de una tarifa, por un cambio con
                      fecha de vigencia. Cada turno se valuó con la tarifa que
                      tenía ese día.
                    </p>
                  )}
                </li>
                <li className="flex items-baseline justify-between py-2.5">
                  <span>Subtotal por horas</span>
                  <span className="tabular-nums font-semibold">
                    {formatCurrency(draft.hourly_amount, draft.currency)}
                  </span>
                </li>

                {draft.fixed_amounts.map((fa) => (
                  <li
                    key={fa.id}
                    className="flex items-baseline justify-between py-2.5"
                  >
                    <span>
                      {fa.description}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({fixedAmountFrequencyLabel(fa.frequency, fa.custom_days)}{" "}
                        × {fa.times_applied})
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(fa.subtotal, draft.currency)}
                    </span>
                  </li>
                ))}

                {draft.fixed_amounts.length === 0 && (
                  <li className="py-2.5 text-xs italic text-muted-foreground">
                    Este empleado no tiene montos fijos activos.
                  </li>
                )}

                <li className="flex items-baseline justify-between border-t-2 border-border-strong py-3 last:pb-0">
                  <span className="text-base font-semibold">
                    Subtotal antes de ajustes
                  </span>
                  <span className="tabular-nums text-lg font-semibold">
                    {formatCurrency(draft.subtotal, draft.currency)}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>

          {pendingShifts.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Hay {pendingShifts.length}{" "}
                {pendingShifts.length === 1
                  ? "turno sin aprobar"
                  : "turnos sin aprobar"}{" "}
                en este período
              </p>
              <p className="mt-1.5 text-sm text-foreground">
                Son {formatHours(pendingHours)} h (~
                {formatCurrency(pendingAmount, draft.currency)}) que{" "}
                <strong className="font-medium">no</strong> entran en este pago.
                Si liquidás ahora, después no vas a poder pagarlos por separado:
                el período va a quedar cerrado.
              </p>
              <Link
                href={`/app/groups/${id}/shifts`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Revisar y aprobar turnos
              </Link>
            </div>
          )}

          <PaymentDraftForm
            groupId={id}
            profileId={profile.id}
            periodStartIso={defaultFromIso}
            periodEndIso={defaultToIso}
            blockedReason={
              pendingShifts.length > 0
                ? pendingShifts.length === 1
                  ? "Aprobá o corregí el turno pendiente antes de liquidar."
                  : `Aprobá o corregí los ${pendingShifts.length} turnos pendientes antes de liquidar.`
                : null
            }
            currency={draft.currency}
            subtotalBeforeAdjustments={draft.subtotal}
          />
        </>
      )}
    </div>
  );
}
