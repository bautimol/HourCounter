import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, ChevronRight, Clock, Coins, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  AR_TIME_ZONE,
  formatCurrency,
  formatDuration,
  formatShortDate,
} from "@/lib/format";
import { PeriodPicker } from "./period-picker";
import { EmployeeFilter, type EmployeeOption } from "./employee-filter";

type PresetKey =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_30_days"
  | "custom";

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const MS_PER_HOUR = 3_600_000;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; employee?: string }>;
}) {
  const { id } = await params;
  const { from, to, employee } = await searchParams;

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

  // ---------------------------------------------------------------------------
  // Period resolution (AR-correct: a picked day runs 00:00→24:00 in Argentina,
  // which is 03:00 UTC → next-day 03:00 UTC since AR is UTC-3 with no DST).
  // ---------------------------------------------------------------------------
  const arToday = arTodayParts();
  const defaultFromStr = arDateStr(arToday.y, arToday.m, 1);
  const defaultToStr = arDateStr(
    arToday.y,
    arToday.m,
    lastDayOfMonth(arToday.y, arToday.m),
  );

  const fromStr = from ?? defaultFromStr;
  const toStr = to ?? defaultToStr;

  const fromInstant = arDayStartUtc(fromStr);
  const toInstant = new Date(
    arDayStartUtc(toStr).getTime() + 24 * MS_PER_HOUR - 1,
  );

  const initialPreset = detectPreset(fromStr, toStr, arToday);

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  const selectedEmployee = employee && employee !== "" ? employee : null;

  const shiftSelect = `employee_profile_id, clock_in, clock_out,
     employee_profile:employee_profiles!inner(
       id, hourly_rate, currency,
       position:positions(hourly_rate, currency),
       group_member:group_members!inner(id, display_name, avatar_url, group_id)
     )`;

  // Chart window: the trailing 6 AR months, independent of the selected
  // period, so the month-to-month comparison stays meaningful.
  const chartFromInstant = arDayStartUtc(
    arDateStr(
      arToday.y,
      arToday.m,
      1,
    ),
  );
  chartFromInstant.setUTCMonth(chartFromInstant.getUTCMonth() - 5);

  const [{ data: employeesRaw }, { data: shiftsRaw }, { data: chartShiftsRaw }] =
    await Promise.all([
      supabase
        .from("group_members")
        .select("id, display_name")
        .eq("group_id", id)
        .eq("role", "employee")
        .eq("status", "active")
        .order("display_name", { ascending: true }),
      supabase
        .from("time_entries")
        .select(shiftSelect)
        .eq("employee_profile.group_member.group_id", id)
        .not("verified_at", "is", null)
        .not("clock_out", "is", null)
        .gte("clock_in", fromInstant.toISOString())
        .lte("clock_in", toInstant.toISOString()),
      supabase
        .from("time_entries")
        .select(shiftSelect)
        .eq("employee_profile.group_member.group_id", id)
        .not("verified_at", "is", null)
        .not("clock_out", "is", null)
        .gte("clock_in", chartFromInstant.toISOString())
        .lte("clock_in", new Date().toISOString()),
    ]);

  type ShiftRow = {
    employee_profile_id: string;
    clock_in: string;
    clock_out: string | null;
    employee_profile?: {
      id: string;
      hourly_rate: number | null;
      currency: string | null;
      position?:
        | { hourly_rate: number | null; currency: string | null }
        | { hourly_rate: number | null; currency: string | null }[]
        | null;
      group_member?:
        | {
            id: string;
            display_name: string | null;
            avatar_url: string | null;
          }
        | {
            id: string;
            display_name: string | null;
            avatar_url: string | null;
          }[]
        | null;
    } | null;
  };

  const employees: EmployeeOption[] = (employeesRaw ?? []).map((e) => ({
    id: e.id,
    name: e.display_name ?? "Empleado",
  }));

  const selectedEmployeeName = selectedEmployee
    ? (employees.find((e) => e.id === selectedEmployee)?.name ?? "Empleado")
    : null;

  // Normalize a shift row into a flat shape with the effective rate resolved.
  function normalize(s: ShiftRow) {
    const ep = s.employee_profile;
    if (!ep || !s.clock_out) return null;
    const gm = Array.isArray(ep.group_member)
      ? ep.group_member[0]
      : ep.group_member;
    if (!gm) return null;
    const pos = Array.isArray(ep.position) ? ep.position[0] : ep.position;

    const rate = ep.hourly_rate ?? pos?.hourly_rate ?? null;
    const currency = ep.currency ?? pos?.currency ?? "ARS";
    const ms =
      new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();

    return {
      memberId: gm.id,
      name: gm.display_name ?? "Empleado",
      avatarUrl: gm.avatar_url ?? null,
      clockIn: s.clock_in,
      ms: Math.max(0, ms),
      rate: rate != null ? Number(rate) : null,
      currency,
    };
  }

  const shifts = ((shiftsRaw ?? []) as unknown as ShiftRow[])
    .map(normalize)
    .filter((s): s is NonNullable<ReturnType<typeof normalize>> => s !== null)
    .filter((s) => (selectedEmployee ? s.memberId === selectedEmployee : true));

  const chartShifts = ((chartShiftsRaw ?? []) as unknown as ShiftRow[])
    .map(normalize)
    .filter((s): s is NonNullable<ReturnType<typeof normalize>> => s !== null)
    .filter((s) => (selectedEmployee ? s.memberId === selectedEmployee : true));

  // ---------------------------------------------------------------------------
  // Per-employee aggregation (hours + money value of those hours)
  // ---------------------------------------------------------------------------
  const byMember = new Map<
    string,
    {
      memberId: string;
      name: string;
      avatarUrl: string | null;
      totalMs: number;
      value: number;
      shiftCount: number;
      currency: string;
      missingRate: boolean;
    }
  >();

  for (const s of shifts) {
    const hours = s.ms / MS_PER_HOUR;
    const existing = byMember.get(s.memberId);
    if (existing) {
      existing.totalMs += s.ms;
      existing.shiftCount += 1;
      if (s.rate != null) existing.value += hours * s.rate;
      else existing.missingRate = true;
    } else {
      byMember.set(s.memberId, {
        memberId: s.memberId,
        name: s.name,
        avatarUrl: s.avatarUrl,
        totalMs: s.ms,
        value: s.rate != null ? hours * s.rate : 0,
        shiftCount: 1,
        currency: s.currency,
        missingRate: s.rate == null,
      });
    }
  }

  const perEmployee = [...byMember.values()].sort(
    (a, b) => b.totalMs - a.totalMs,
  );

  // KPI totals
  const totalHoursMs = shifts.reduce((sum, s) => sum + s.ms, 0);
  const totalValue = perEmployee.reduce((sum, e) => sum + e.value, 0);
  const totalShifts = shifts.length;
  const employeeCount = perEmployee.length;

  // Dominant currency (the app doesn't sum across currencies — pick the most
  // common so the top-line total is labeled sensibly).
  const currencyCount = new Map<string, number>();
  for (const s of shifts) {
    currencyCount.set(s.currency, (currencyCount.get(s.currency) ?? 0) + 1);
  }
  let topCurrency = "ARS";
  let topCount = 0;
  for (const [cur, cnt] of currencyCount) {
    if (cnt > topCount) {
      topCurrency = cur;
      topCount = cnt;
    }
  }

  const anyMissingRate = perEmployee.some((e) => e.missingRate);

  // ---------------------------------------------------------------------------
  // Monthly chart: value of hours worked, bucketed by AR month of clock_in
  // ---------------------------------------------------------------------------
  const months: { label: string; key: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    // Walk back i months from the first of the current AR month.
    const d = new Date(Date.UTC(arToday.y, arToday.m - 1 - i, 1));
    const y = d.getUTCFullYear();
    const mIdx = d.getUTCMonth();
    const key = `${y}-${String(mIdx + 1).padStart(2, "0")}`;
    months.push({
      label: `${MONTHS_ES[mIdx]} ${String(y).slice(-2)}`,
      key,
      total: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i] as const));
  for (const s of chartShifts) {
    if (s.rate == null) continue;
    const key = arMonthKey(new Date(s.clockIn));
    const idx = monthIndex.get(key);
    if (idx != null) {
      months[idx]!.total += (s.ms / MS_PER_HOUR) * s.rate;
    }
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  // Single-employee shift detail (sorted most recent first)
  const shiftDetail = selectedEmployee
    ? [...shifts].sort(
        (a, b) =>
          new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
      )
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Reportes" },
        ]}
        title="Reportes"
        subtitle="Horas trabajadas y su valor en el período seleccionado (turnos verificados)."
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PeriodPicker
          initialFrom={fromStr}
          initialTo={toStr}
          initialPreset={initialPreset}
        />
        {employees.length > 0 && (
          <EmployeeFilter employees={employees} selected={selectedEmployee} />
        )}
      </div>

      {selectedEmployeeName && (
        <p className="text-sm text-muted-foreground">
          Mostrando solo{" "}
          <span className="font-medium text-foreground">
            {selectedEmployeeName}
          </span>
          .
        </p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Horas trabajadas"
          value={formatDuration(totalHoursMs)}
          icon={<Clock className="h-4 w-4" aria-hidden />}
          accent
        />
        <Kpi
          label="Valor de esas horas"
          value={formatCurrency(totalValue, topCurrency)}
          icon={<Coins className="h-4 w-4" aria-hidden />}
        />
        <Kpi
          label={selectedEmployee ? "Turnos" : "Empleados con turnos"}
          value={String(selectedEmployee ? totalShifts : employeeCount)}
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
      </div>

      {anyMissingRate && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          Algunos turnos son de empleados sin tarifa configurada — sus horas
          cuentan pero su valor en dinero es $0 hasta que les asignes una
          tarifa.
        </p>
      )}

      {/* Per-employee (hidden when a single employee is selected) */}
      {!selectedEmployee && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden />
            Por empleado
          </h2>
          {perEmployee.length === 0 ? (
            <Card className="border-dashed">
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No hay turnos verificados en este período.
              </p>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {perEmployee.map((row) => (
                  <li key={row.memberId}>
                    <Link
                      href={`/app/groups/${id}/members/${row.memberId}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                    >
                      <Avatar name={row.name} src={row.avatarUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {row.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(row.totalMs)} · {row.shiftCount}{" "}
                          {row.shiftCount === 1 ? "turno" : "turnos"}
                          {row.missingRate && " · sin tarifa"}
                        </p>
                      </div>
                      <span className="text-base font-semibold tabular-nums">
                        {formatCurrency(row.value, row.currency)}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* Single-employee shift breakdown */}
      {selectedEmployee && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            Detalle de turnos
          </h2>
          {shiftDetail.length === 0 ? (
            <Card className="border-dashed">
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No hay turnos verificados en este período.
              </p>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {shiftDetail.map((s, i) => {
                  const hours = s.ms / MS_PER_HOUR;
                  const value = s.rate != null ? hours * s.rate : 0;
                  return (
                    <li
                      key={`${s.clockIn}-${i}`}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {formatShortDate(new Date(s.clockIn))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(s.ms)}
                          {s.rate != null &&
                            ` · ${formatCurrency(s.rate, s.currency)}/h`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {s.rate != null ? (
                          formatCurrency(value, s.currency)
                        ) : (
                          <Badge variant="muted">sin tarifa</Badge>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* Monthly chart: value of hours worked */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BarChart3 className="h-4 w-4" aria-hidden />
          Valor de horas trabajadas, mes a mes
          <span className="text-[11px] font-normal text-muted-foreground">
            (últimos 6 meses)
          </span>
        </h2>
        <Card>
          <div className="grid grid-cols-6 items-end gap-3 px-5 py-6">
            {months.map((m) => {
              const pct = (m.total / maxMonth) * 100;
              return (
                <div key={m.key} className="flex flex-col items-center gap-2">
                  <div className="relative flex h-32 w-full items-end justify-center">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-b from-emerald-400 to-emerald-600 transition-[height] duration-500 dark:from-emerald-500 dark:to-emerald-700"
                      style={{ height: `${Math.max(2, pct)}%` }}
                      title={formatCurrency(m.total, topCurrency)}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums">
                    {m.total === 0 ? "—" : compactCurrency(m.total, topCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-sm ${
        accent
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border bg-surface/60"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          accent ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// AR-timezone date helpers
// ----------------------------------------------------------------------------

/** Current Y/M/D in Argentina as numbers (m is 1-based). */
function arTodayParts(): { y: number; m: number; d: number } {
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
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

function arDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDayOfMonth(y: number, m: number): number {
  // m is 1-based; day 0 of next month = last day of this month.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** UTC instant of "00:00 in Argentina" for a YYYY-MM-DD (AR is UTC-3, no DST). */
function arDayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T03:00:00.000Z`);
}

/** AR calendar "YYYY-MM" of an instant. */
function arMonthKey(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}`;
}

function detectPreset(
  fromStr: string,
  toStr: string,
  arToday: { y: number; m: number; d: number },
): PresetKey {
  const { y, m } = arToday;

  if (
    fromStr === arDateStr(y, m, 1) &&
    toStr === arDateStr(y, m, lastDayOfMonth(y, m))
  )
    return "this_month";

  const lm = new Date(Date.UTC(y, m - 2, 1));
  const lmY = lm.getUTCFullYear();
  const lmM = lm.getUTCMonth() + 1;
  if (
    fromStr === arDateStr(lmY, lmM, 1) &&
    toStr === arDateStr(lmY, lmM, lastDayOfMonth(lmY, lmM))
  )
    return "last_month";

  if (fromStr === arDateStr(y, 1, 1) && toStr === arDateStr(y, 12, 31))
    return "this_year";

  // last 30 days: [today-29 .. today]
  const end = new Date(Date.UTC(y, m - 1, arToday.d));
  const start = new Date(end.getTime() - 29 * 24 * MS_PER_HOUR);
  const startStr = arDateStr(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
  );
  const endStr = arDateStr(y, m, arToday.d);
  if (fromStr === startStr && toStr === endStr) return "last_30_days";

  return "custom";
}

function compactCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const symbol = currency === "ARS" ? "$" : currency + " ";
  if (abs >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}k`;
  return `${symbol}${amount.toFixed(0)}`;
}
