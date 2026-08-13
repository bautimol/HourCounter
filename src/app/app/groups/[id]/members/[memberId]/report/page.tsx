import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  arCalendarDay,
  conceptShortLabel,
  formatCurrency,
  formatDayMonthYear,
  formatHours,
} from "@/lib/format";
import { PeriodPicker } from "../../../reports/period-picker";
import { ReportActions } from "./report-actions";

type EntryRow = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  concept: string;
  hourly_rate: number | null;
  verified_at: string | null;
  notes: string | null;
};

/**
 * One printed line: a day, a concept, a rate and an approval state — none of
 * them mix within a row, so every line can be attributed to exactly one total.
 */
type DayRow = {
  key: string;
  dayIso: string;
  date: Date;
  concept: string;
  rate: number;
  minutes: number;
  descriptions: string[];
  verified: boolean;
};

export default async function MemberReportPage({
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
    .select("id, role, display_name")
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
    redirect(`/app/groups/${id}/members/${memberId}/edit`);
  }

  // Default range: the current month, resolved in Argentina (the server is UTC,
  // so "today" here would otherwise flip a day early every evening).
  const todayAr = arCalendarDay(new Date());
  const [curYear, curMonth] = todayAr.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(Date.UTC(curYear!, curMonth!, 0)).getUTCDate();
  const defaultFrom = `${curYear}-${pad(curMonth!)}-01`;
  const defaultTo = `${curYear}-${pad(curMonth!)}-${pad(daysInMonth)}`;

  const isValid = (s: string | undefined): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const from = isValid(fromParam) ? fromParam : defaultFrom;
  const to = isValid(toParam) ? toParam : defaultTo;

  // Argentina is UTC-3 year-round, so the day boundaries are exact.
  const fromIso = `${from}T00:00:00.000-03:00`;
  const toIso = `${to}T23:59:59.999-03:00`;

  const { data: effRow } = await supabase
    .rpc("effective_employee_profile", { profile_id: profile.id })
    .single();
  const effective = effRow as { hourly_rate: number | null; currency: string } | null;
  const liveRate = Number(effective?.hourly_rate ?? 0);
  const currency = effective?.currency ?? "ARS";

  const { data: rawEntries } = await supabase
    .from("time_entries")
    .select("id, clock_in, clock_out, concept, hourly_rate, verified_at, notes")
    .eq("employee_profile_id", profile.id)
    .not("clock_out", "is", null)
    .gte("clock_in", fromIso)
    .lte("clock_in", toIso)
    .order("clock_in", { ascending: true });

  const entries = (rawEntries ?? []) as EntryRow[];

  // Group into printed lines. A shift frozen at an old rate keeps that rate
  // (same rule the payment draft uses), so a day whose shifts were priced
  // differently splits into two honest lines instead of averaging.
  const byKey = new Map<string, DayRow>();

  for (const e of entries) {
    if (!e.clock_out) continue;
    const start = new Date(e.clock_in);
    const minutes =
      (new Date(e.clock_out).getTime() - start.getTime()) / 60000;
    if (!(minutes > 0)) continue;

    const rate = e.hourly_rate == null ? liveRate : Number(e.hourly_rate);
    const dayIso = arCalendarDay(start);
    const verified = e.verified_at != null;
    const key = `${dayIso}|${e.concept}|${rate}|${verified ? "v" : "p"}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.minutes += minutes;
      if (e.notes) existing.descriptions.push(e.notes);
    } else {
      byKey.set(key, {
        key,
        dayIso,
        date: start,
        concept: e.concept,
        rate,
        minutes,
        descriptions: e.notes ? [e.notes] : [],
        verified,
      });
    }
  }

  const rows = [...byKey.values()].sort((a, b) =>
    a.dayIso === b.dayIso
      ? a.concept.localeCompare(b.concept)
      : a.dayIso.localeCompare(b.dayIso),
  );

  // Approved and pending are totalled separately: only approved days are what
  // the liquidation will actually pay, and this sheet gets signed.
  const sum = (list: DayRow[]) => ({
    hours: list.reduce((acc, r) => acc + r.minutes / 60, 0),
    amount: list.reduce((acc, r) => acc + (r.minutes / 60) * r.rate, 0),
    days: new Set(list.map((r) => r.dayIso)).size,
  });

  const approved = sum(rows.filter((r) => r.verified));
  const pending = sum(rows.filter((r) => !r.verified));
  const totalHours = approved.hours + pending.hours;
  const totalAmount = approved.amount + pending.amount;
  const anyUnverified = pending.hours > 0;

  const memberName = member.display_name ?? "Empleado";
  const rangeLabel = `${formatDayMonthYear(new Date(fromIso))} al ${formatDayMonthYear(new Date(toIso))}`;

  // Plain text for WhatsApp / mail. Built here so it can never disagree with
  // the table rendered below.
  const shareText = [
    `${memberName} — ${group.name}`,
    `Período: ${rangeLabel}`,
    "",
    ...rows.map(
      (r) =>
        `${formatDayMonthYear(r.date)} · ${conceptShortLabel(r.concept)} · ` +
        `${formatHours(r.minutes / 60)} h · ${formatCurrency(r.rate, currency)}/h · ` +
        `${formatCurrency((r.minutes / 60) * r.rate, currency)}` +
        (r.verified ? "" : " · SIN APROBAR"),
    ),
    "",
    `TOTAL APROBADO: ${formatHours(approved.hours)} h · ${formatCurrency(approved.amount, currency)}`,
    ...(anyUnverified
      ? [
          `Pendiente de aprobar: ${formatHours(pending.hours)} h · ${formatCurrency(pending.amount, currency)}`,
        ]
      : []),
  ].join("\n");

  const isThisMonth = from === defaultFrom && to === defaultTo;
  const initialPreset = (isThisMonth ? "this_month" : "custom") as
    | "this_month"
    | "custom";

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          crumbs={[
            { label: "Tus grupos", href: "/app" },
            { label: group.name, href: `/app/groups/${id}` },
            {
              label: memberName,
              href: `/app/groups/${id}/members/${memberId}`,
            },
            { label: "Reporte" },
          ]}
          title="Reporte por día"
          subtitle="Detalle de los días del período, con su concepto y su valor."
          icon={<FileSpreadsheet className="h-5 w-5" aria-hidden />}
          accent="emerald"
        />
      </div>

      <div className="print:hidden">
        <Card>
          <CardBody className="space-y-4">
            <PeriodPicker
              initialFrom={from}
              initialTo={to}
              initialPreset={initialPreset}
            />
            <ReportActions shareText={shareText} />
          </CardBody>
        </Card>
      </div>

      {liveRate === 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 print:hidden dark:text-amber-300">
          Este empleado no tiene tarifa por hora configurada, así que los
          valores salen en cero.{" "}
          <Link
            href={`/app/groups/${id}/members/${memberId}/edit`}
            className="font-medium underline"
          >
            Configurar tarifa
          </Link>
        </div>
      )}

      <article
        id="reporte"
        className="rounded-2xl border border-border bg-surface p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none"
      >
        <header className="mb-5 border-b border-border pb-4">
          <h2 className="text-lg font-semibold">{memberName}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {group.name} · Período {rangeLabel}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay días registrados en este período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Concepto</th>
                  <th className="py-2 pr-3 text-right font-medium">Horas</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    Valor por hora
                  </th>
                  <th className="py-2 text-right font-medium">Total del día</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/60">
                    <td className="py-2 pr-3 tabular-nums">
                      {formatDayMonthYear(r.date)}
                    </td>
                    <td className="py-2 pr-3">
                      {conceptShortLabel(r.concept)}
                      {!r.verified && (
                        <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-300">
                          (sin aprobar)
                        </span>
                      )}
                      {r.descriptions.length > 0 && (
                        <span className="block text-xs italic text-muted-foreground">
                          {r.descriptions.join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatHours(r.minutes / 60)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatCurrency(r.rate, currency)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency((r.minutes / 60) * r.rate, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-3 pr-3" colSpan={2}>
                    Total aprobado ({approved.days}{" "}
                    {approved.days === 1 ? "día" : "días"})
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {formatHours(approved.hours)}
                  </td>
                  <td className="py-3 pr-3" />
                  <td className="py-3 text-right tabular-nums">
                    {formatCurrency(approved.amount, currency)}
                  </td>
                </tr>
                {anyUnverified && (
                  <>
                    <tr className="text-amber-700 dark:text-amber-300">
                      <td className="py-2 pr-3" colSpan={2}>
                        Pendiente de aprobar ({pending.days}{" "}
                        {pending.days === 1 ? "día" : "días"})
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatHours(pending.hours)}
                      </td>
                      <td className="py-2 pr-3" />
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pending.amount, currency)}
                      </td>
                    </tr>
                    <tr className="border-t border-border font-semibold">
                      <td className="py-2 pr-3" colSpan={2}>
                        Total del período
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatHours(totalHours)}
                      </td>
                      <td className="py-2 pr-3" />
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(totalAmount, currency)}
                      </td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        )}

        {anyUnverified && (
          <p className="mt-4 text-xs text-muted-foreground">
            Los días &quot;sin aprobar&quot; todavía no fueron revisados por el
            empleador: están sumados aparte y no entran en el pago hasta que se
            aprueben.
          </p>
        )}

        <section className="mt-10 grid grid-cols-2 gap-12 pt-6 print:mt-16">
          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            Firma del empleado
          </div>
          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            Firma del empleador
          </div>
        </section>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Emitido el {formatDayMonthYear(new Date())} · Clockity
        </p>
      </article>

      <style>{`
        @media print {
          body { background: white !important; }
          header, nav, .print\\:hidden { display: none !important; }
          /* The rule above hides the app chrome, but this sheet has its OWN
             <header> (name, group, period) — without re-showing it the printed
             page comes out anonymous. Scoped to #reporte so the layout of
             everything else (grids, flex) is untouched; higher specificity
             than the bare "header" selector, so it wins. */
          #reporte header { display: block !important; }
          #reporte { max-width: 100% !important; margin: 0 !important; padding: 24px !important; }
          @page { margin: 16mm; }
        }
      `}</style>
    </div>
  );
}
