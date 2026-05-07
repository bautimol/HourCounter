import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ShiftBulkActions } from "./shift-bulk-actions";

type Filter = "pending" | "verified" | "needs_review" | "all";
const FILTERS: Filter[] = ["pending", "verified", "needs_review", "all"];

const FILTER_LABEL: Record<Filter, string> = {
  pending: "Pendientes",
  verified: "Verificados",
  needs_review: "Para revisar",
  all: "Todos",
};

type ShiftRow = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: "open" | "closed" | "needs_review";
  notes: string | null;
  verified_at: string | null;
  expected_minutes: number | null;
  employee_profile: {
    group_member: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  } | null;
};

export default async function ShiftsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: statusParam } = await searchParams;
  const filter: Filter = (FILTERS.includes(statusParam as Filter)
    ? statusParam
    : "pending") as Filter;

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

  // Sweep stale shifts before reading.
  await supabase.rpc("auto_close_expired_shifts");

  // Build the query with the requested filter applied.
  let q = supabase
    .from("time_entries")
    .select(
      `id, clock_in, clock_out, status, notes, verified_at, expected_minutes,
       employee_profile:employee_profiles!inner(
         group_member:group_members!inner(
           id, display_name, avatar_url, group_id, status
         )
       )`,
    )
    .eq("employee_profile.group_member.group_id", id)
    .eq("employee_profile.group_member.status", "active")
    .order("clock_in", { ascending: false })
    .limit(100);

  if (filter === "pending") {
    // Closed (or auto-closed) but not yet verified.
    q = q.eq("status", "closed").is("verified_at", null);
  } else if (filter === "verified") {
    q = q.not("verified_at", "is", null);
  } else if (filter === "needs_review") {
    q = q.eq("status", "needs_review");
  }
  // "all" → no extra filter

  const { data: rawShifts, error } = await q;
  const shifts = ((rawShifts ?? []) as unknown as ShiftRow[]).map((s) => ({
    ...s,
    member: Array.isArray(s.employee_profile?.group_member)
      ? s.employee_profile?.group_member[0]
      : s.employee_profile?.group_member,
  }));

  // Pending count for the tab pill (independent of current filter).
  const { count: pendingCount } = await supabase
    .from("time_entries")
    .select(
      "id, employee_profile:employee_profiles!inner(group_member:group_members!inner(group_id, status))",
      { count: "exact", head: true },
    )
    .eq("employee_profile.group_member.group_id", id)
    .eq("employee_profile.group_member.status", "active")
    .eq("status", "closed")
    .is("verified_at", null);

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Turnos" },
        ]}
        title="Verificación de turnos"
        subtitle="Aprobá, editá o flageá los turnos cerrados de tus empleados."
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      {/* Filter tabs */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-xs">
        {FILTERS.map((f) => {
          const active = filter === f;
          const showCount = f === "pending" && (pendingCount ?? 0) > 0;
          return (
            <Link
              key={f}
              href={`/app/groups/${id}/shifts?status=${f}`}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-accent text-accent-foreground shadow-sm shadow-emerald-700/20"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground")
              }
            >
              {FILTER_LABEL[f]}
              {showCount && (
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                    (active
                      ? "bg-white/20 text-accent-foreground"
                      : "bg-accent-soft text-accent-soft-foreground")
                  }
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {error && (
        <Card className="border-danger/40">
          <p className="px-5 py-4 text-sm text-danger">
            Error cargando turnos: {error.message}
          </p>
        </Card>
      )}

      {!error && shifts.length === 0 && (
        <Card className="border-dashed">
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {filter === "pending"
              ? "Todo al día. No hay turnos pendientes de verificar."
              : "No hay turnos en este filtro."}
          </div>
        </Card>
      )}

      {shifts.length > 0 && (
        <ShiftBulkActions
          groupId={id}
          allowSelect={filter === "pending"}
          shifts={shifts.map((s) => ({
            id: s.id,
            clockIn: s.clock_in,
            clockOut: s.clock_out,
            status: s.status,
            notes: s.notes,
            verifiedAt: s.verified_at,
            member: s.member ?? null,
          }))}
        />
      )}
    </div>
  );
}
