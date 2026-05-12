import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  Clock,
  Coins,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDuration } from "@/lib/format";
import { PeriodPicker } from "./period-picker";

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

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;

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
  // Period resolution
  // ---------------------------------------------------------------------------
  const today = new Date();
  const defaultFromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultToDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const fromDate = from ? parseLocalDate(from) : defaultFromDate;
  const toDate = to ? parseLocalDate(to) : defaultToDate;

  // Inclusive day boundaries: from = start of day, to = end of day.
  const fromIso = startOfDay(fromDate).toISOString();
  const toIso = endOfDay(toDate).toISOString();

  const initialFromStr = formatLocalIso(fromDate);
  const initialToStr = formatLocalIso(toDate);
  const initialPreset = detectPreset(fromDate, toDate);

  // ---------------------------------------------------------------------------
  // Data: payments in range, verified shifts in range, last 6 months of pmts
  // ---------------------------------------------------------------------------
  const [
    { data: paymentsRaw },
    { data: shiftsRaw },
    { data: monthlyPaymentsRaw },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `id, total_amount, paid_at,
         employee_profile:employee_profiles!inner(
           id, currency,
           group_member:group_members!inner(id, display_name, avatar_url, group_id)
         )`,
      )
      .eq("employee_profile.group_member.group_id", id)
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso),
    supabase
      .from("time_entries")
      .select(
        `employee_profile_id, clock_in, clock_out,
         employee_profile:employee_profiles!inner(
           id,
           group_member:group_members!inner(id, display_name, avatar_url, group_id)
         )`,
      )
      .eq("employee_profile.group_member.group_id", id)
      .not("verified_at", "is", null)
      .not("clock_out", "is", null)
      .gte("clock_in", fromIso)
      .lte("clock_in", toIso),
    supabase
      .from("payments")
      .select(
        `total_amount, paid_at,
         employee_profile:employee_profiles!inner(
           group_member:group_members!inner(group_id)
         )`,
      )
      .eq("employee_profile.group_member.group_id", id)
      .gte("paid_at", monthsAgoIso(5))
      .lte("paid_at", endOfDay(today).toISOString()),
  ]);

  // ---------------------------------------------------------------------------
  // Aggregations
  // ---------------------------------------------------------------------------
  type PaymentRow = {
    id: string;
    total_amount: number;
    paid_at: string;
    employee_profile?: {
      id: string;
      currency: string | null;
      group_member?: {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
      } | { id: string; display_name: string | null; avatar_url: string | null }[]
        | null;
    } | null;
  };

  type ShiftRow = {
    employee_profile_id: string;
    clock_in: string;
    clock_out: string | null;
    employee_profile?: {
      id: string;
      group_member?: {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
      } | { id: string; display_name: string | null; avatar_url: string | null }[]
        | null;
    } | null;
  };

  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[];
  const shifts = (shiftsRaw ?? []) as unknown as ShiftRow[];
  const monthlyRaw = (monthlyPaymentsRaw ?? []) as unknown as {
    total_amount: number;
    paid_at: string;
  }[];

  // Per-employee payment totals
  const payByMember = new Map<
    string,
    {
      memberId: string;
      name: string;
      avatarUrl: string | null;
      total: number;
      count: number;
      currency: string;
    }
  >();

  for (const p of payments) {
    const ep = p.employee_profile;
    if (!ep) continue;
    const gmRaw = ep.group_member;
    const gm = Array.isArray(gmRaw) ? gmRaw[0] : gmRaw;
    if (!gm) continue;
    const key = gm.id;
    const existing = payByMember.get(key);
    if (existing) {
      existing.total += Number(p.total_amount);
      existing.count += 1;
    } else {
      payByMember.set(key, {
        memberId: gm.id,
        name: gm.display_name ?? "Empleado",
        avatarUrl: gm.avatar_url ?? null,
        total: Number(p.total_amount),
        count: 1,
        currency: ep.currency ?? "ARS",
      });
    }
  }

  const paymentsByEmployee = [...payByMember.values()].sort(
    (a, b) => b.total - a.total,
  );

  // Per-employee hours totals (verified, closed shifts only)
  const hoursByMemberMap = new Map<
    string,
    {
      memberId: string;
      name: string;
      avatarUrl: string | null;
      totalMs: number;
      shiftCount: number;
    }
  >();

  for (const s of shifts) {
    if (!s.clock_out) continue;
    const ep = s.employee_profile;
    if (!ep) continue;
    const gmRaw = ep.group_member;
    const gm = Array.isArray(gmRaw) ? gmRaw[0] : gmRaw;
    if (!gm) continue;
    const ms = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();
    if (ms <= 0) continue;
    const existing = hoursByMemberMap.get(gm.id);
    if (existing) {
      existing.totalMs += ms;
      existing.shiftCount += 1;
    } else {
      hoursByMemberMap.set(gm.id, {
        memberId: gm.id,
        name: gm.display_name ?? "Empleado",
        avatarUrl: gm.avatar_url ?? null,
        totalMs: ms,
        shiftCount: 1,
      });
    }
  }

  const hoursByEmployee = [...hoursByMemberMap.values()].sort(
    (a, b) => b.totalMs - a.totalMs,
  );

  // KPI totals (top of dashboard)
  const totalPaid = paymentsByEmployee.reduce((sum, p) => sum + p.total, 0);
  const totalHoursMs = hoursByEmployee.reduce((sum, h) => sum + h.totalMs, 0);
  const employeesPaid = paymentsByEmployee.length;

  // Top-line currency: most common across payments in range. Defaults to ARS.
  const currencyCount = new Map<string, number>();
  for (const p of paymentsByEmployee) {
    currencyCount.set(p.currency, (currencyCount.get(p.currency) ?? 0) + 1);
  }
  let topCurrency = "ARS";
  let topCount = 0;
  for (const [cur, cnt] of currencyCount) {
    if (cnt > topCount) {
      topCurrency = cur;
      topCount = cnt;
    }
  }

  // Last 6 months bucketing (for the bar chart). We use [first day of month
  // five months ago] through [today] regardless of the selected period.
  const months: { label: string; key: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      label: `${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      key,
      total: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i] as const));
  for (const m of monthlyRaw) {
    const d = new Date(m.paid_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx != null) {
      months[idx]!.total += Number(m.total_amount);
    }
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Reportes" },
        ]}
        title="Reportes"
        subtitle="Pagos y horas del grupo en el período seleccionado."
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <PeriodPicker
        initialFrom={initialFromStr}
        initialTo={initialToStr}
        initialPreset={initialPreset}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Pagado total"
          value={formatCurrency(totalPaid, topCurrency)}
          icon={<Coins className="h-4 w-4" aria-hidden />}
          accent
        />
        <Kpi
          label="Horas trabajadas"
          value={formatDuration(totalHoursMs)}
          icon={<Clock className="h-4 w-4" aria-hidden />}
        />
        <Kpi
          label="Empleados pagados"
          value={String(employeesPaid)}
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
      </div>

      {/* Payments per employee */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Coins className="h-4 w-4" aria-hidden />
          Pagos por empleado
        </h2>
        {paymentsByEmployee.length === 0 ? (
          <Card className="border-dashed">
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay pagos en este período.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {paymentsByEmployee.map((row) => (
                <li key={row.memberId}>
                  <Link
                    href={`/app/groups/${id}/members/${row.memberId}`}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50"
                  >
                    <Avatar
                      name={row.name}
                      src={row.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.count} {row.count === 1 ? "pago" : "pagos"}
                      </p>
                    </div>
                    <span className="text-base font-semibold tabular-nums">
                      {formatCurrency(row.total, row.currency)}
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

      {/* Hours per employee */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden />
          Horas por empleado
          <span className="text-[11px] font-normal text-muted-foreground">
            (turnos verificados)
          </span>
        </h2>
        {hoursByEmployee.length === 0 ? (
          <Card className="border-dashed">
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay turnos verificados en este período.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {hoursByEmployee.map((row) => (
                <li
                  key={row.memberId}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Avatar
                    name={row.name}
                    src={row.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.shiftCount}{" "}
                      {row.shiftCount === 1 ? "turno" : "turnos"}
                    </p>
                  </div>
                  <span className="text-base font-semibold tabular-nums">
                    {formatDuration(row.totalMs)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Monthly comparativa */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BarChart3 className="h-4 w-4" aria-hidden />
          Pagado mes a mes
          <span className="text-[11px] font-normal text-muted-foreground">
            (últimos 6 meses)
          </span>
        </h2>
        <Card>
          <div className="grid grid-cols-6 items-end gap-3 px-5 py-6">
            {months.map((m) => {
              const pct = (m.total / maxMonth) * 100;
              return (
                <div
                  key={m.key}
                  className="flex flex-col items-center gap-2"
                >
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
                    {m.total === 0
                      ? "—"
                      : compactCurrency(m.total, topCurrency)}
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
          accent
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers (date parsing, ISO formatting, preset detection)
// ----------------------------------------------------------------------------

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function formatLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsAgoIso(monthsBack: number): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function detectPreset(from: Date, to: Date): PresetKey {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (isSameDay(from, thisMonthStart) && isSameDay(to, thisMonthEnd))
    return "this_month";

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  if (isSameDay(from, lastMonthStart) && isSameDay(to, lastMonthEnd))
    return "last_month";

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  if (isSameDay(from, yearStart) && isSameDay(to, yearEnd))
    return "this_year";

  const last30End = new Date();
  last30End.setHours(0, 0, 0, 0);
  const last30Start = new Date(last30End);
  last30Start.setDate(last30Start.getDate() - 29);
  if (
    isSameDay(from, last30Start) &&
    isSameDay(startOfDay(to), startOfDay(last30End))
  )
    return "last_30_days";

  return "custom";
}

function compactCurrency(amount: number, currency: string): string {
  // For chart labels: shorten ARS 1.500.000 → "$1,5M"
  const abs = Math.abs(amount);
  const symbol = currency === "ARS" ? "$" : currency + " ";
  if (abs >= 1_000_000)
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}k`;
  return `${symbol}${amount.toFixed(0)}`;
}
