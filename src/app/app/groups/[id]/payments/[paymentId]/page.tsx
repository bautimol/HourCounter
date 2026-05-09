import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { PaymentActionsBar } from "./payment-actions-bar";

type Adjustment = {
  id: string;
  description: string;
  amount: number;
};

type PaymentRow = {
  id: string;
  period_start: string;
  period_end: string;
  hours_worked: number;
  hourly_amount: number;
  fixed_amounts_total: number;
  adjustments_total: number;
  total_amount: number;
  notes: string | null;
  paid_at: string;
  employee_profile: {
    currency: string | null;
    group_member: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
};

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
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

  const { data: rawPayment } = await supabase
    .from("payments")
    .select(
      `id, period_start, period_end, hours_worked, hourly_amount,
       fixed_amounts_total, adjustments_total, total_amount, notes, paid_at,
       employee_profile:employee_profiles!inner(
         currency,
         group_member:group_members!inner(id, display_name, avatar_url)
       )`,
    )
    .eq("id", paymentId)
    .maybeSingle();

  const payment = rawPayment as unknown as PaymentRow | null;
  if (!payment) notFound();

  const ep = payment.employee_profile;
  const currency = ep?.currency ?? "ARS";
  const member = Array.isArray(ep?.group_member)
    ? ep?.group_member?.[0]
    : ep?.group_member;
  if (!member) notFound();

  const { data: adjustments } = await supabase
    .from("payment_adjustments")
    .select("id, description, amount")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: true });

  const adjs: Adjustment[] = (adjustments ?? []) as unknown as Adjustment[];

  const memberName = member.display_name ?? "Empleado";
  const periodStart = new Date(payment.period_start);
  const periodEnd = new Date(payment.period_end);
  const paidAt = new Date(payment.paid_at);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Screen-only header (hidden on print) */}
      <div className="print:hidden">
        <PageHeader
          crumbs={[
            { label: "Tus grupos", href: "/app" },
            { label: group.name, href: `/app/groups/${id}` },
            { label: "Pagos", href: `/app/groups/${id}/payments` },
            { label: memberName },
          ]}
          title="Liquidación"
          subtitle={`Pagado ${paidAt.toLocaleString("es-AR")}`}
          icon={<Coins className="h-5 w-5" aria-hidden />}
          accent="emerald"
          actions={
            <PaymentActionsBar groupId={id} paymentId={paymentId} />
          }
        />
      </div>

      {/* Print-document version. The receipt itself is also visible on
          screen — the surrounding chrome is what's hidden. */}
      <article
        id="liquidacion"
        className="rounded-2xl border border-border bg-surface p-8 shadow-sm shadow-black/5 print:rounded-none print:border-0 print:shadow-none"
      >
        {/* Brand bar (visible always; lighter on screen, prominent on print) */}
        <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Liquidación
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-mono uppercase tracking-wider">HourCounter</p>
            <p className="mt-0.5 tabular-nums">
              {paidAt.toLocaleDateString("es-AR")}
            </p>
          </div>
        </header>

        {/* Employee + period */}
        <section className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Empleado
            </p>
            <div className="flex items-center gap-3">
              <Avatar
                name={memberName}
                src={member.avatar_url}
                size="sm"
              />
              <p className="text-sm font-medium">{memberName}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </p>
            <p className="text-sm tabular-nums">
              {formatShortDate(periodStart)}
              {" → "}
              {formatShortDate(periodEnd)}
            </p>
          </div>
        </section>

        {/* Breakdown */}
        <section className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Detalle
          </p>
          <ul className="divide-y divide-border text-sm">
            <li className="flex items-baseline justify-between py-2">
              <span>
                Horas trabajadas
                <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                  ({payment.hours_worked.toLocaleString("es-AR")} h)
                </span>
              </span>
              <span className="tabular-nums">
                {formatCurrency(payment.hourly_amount, currency)}
              </span>
            </li>

            {payment.fixed_amounts_total > 0 && (
              <li className="flex items-baseline justify-between py-2">
                <span>Adicionales fijos</span>
                <span className="tabular-nums">
                  {formatCurrency(payment.fixed_amounts_total, currency)}
                </span>
              </li>
            )}

            {adjs.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between py-2"
              >
                <span className="text-muted-foreground">{a.description}</span>
                <span
                  className={
                    "tabular-nums " +
                    (Number(a.amount) < 0 ? "text-danger" : "")
                  }
                >
                  {Number(a.amount) < 0 ? "− " : ""}
                  {formatCurrency(Math.abs(Number(a.amount)), currency)}
                </span>
              </li>
            ))}

            <li className="flex items-baseline justify-between border-t-2 border-border-strong pt-3">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-semibold tabular-nums">
                {formatCurrency(payment.total_amount, currency)}
              </span>
            </li>
          </ul>
        </section>

        {payment.notes && (
          <section className="mb-6">
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Notas
            </p>
            <p className="rounded-md border border-border bg-surface-muted/40 p-3 text-sm italic text-muted-foreground">
              {payment.notes}
            </p>
          </section>
        )}

        {/* Signature lines, only visible on print and screen-only fallback */}
        <section className="mt-10 grid grid-cols-2 gap-12 pt-6 print:mt-16">
          <div>
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Firma empleador
            </div>
          </div>
          <div>
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Firma empleado
            </div>
          </div>
        </section>
      </article>

      {/* Print stylesheet — hide everything but the receipt. */}
      <style>
        {`
          @media print {
            body { background: white !important; }
            header, nav, .print\\:hidden { display: none !important; }
            #liquidacion {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
            }
            @page { margin: 16mm; }
          }
        `}
      </style>

      <div className="flex justify-end print:hidden">
        <Link
          href={`/app/groups/${id}/members/${member.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Ver perfil del empleado →
        </Link>
      </div>
    </div>
  );
}
