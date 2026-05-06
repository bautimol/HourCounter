import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  Clock,
  Coins,
  Settings as SettingsIcon,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LiveBadge } from "@/components/ui/live-badge";
import { MotionList, MotionListItem } from "@/components/motion-list";
import { ClockCard, type OpenShift } from "./clock/clock-card";
import { RecentShiftsList, type RecentShift } from "./clock/recent-shifts";
import { startOfTodayIso } from "@/lib/format";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, avatar_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    return (
      <p className="text-sm text-danger">
        Error cargando el grupo: {groupError.message}
      </p>
    );
  }

  if (!group) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("id, role")
    .eq("group_id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: members } = await supabase
    .from("group_members")
    .select(
      `id, role, display_name, avatar_url, joined_at, user_id,
       employee_profile:employee_profiles(
         id,
         position:positions(name)
       )`,
    )
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  // Per-viewer nicknames: load only mine for the members of this group.
  const memberIds = (members ?? []).map((m) => m.id);
  const { data: nicknameRows } =
    memberIds.length > 0
      ? await supabase
          .from("member_nicknames")
          .select("target_member_id, nickname")
          .eq("viewer_user_id", user!.id)
          .in("target_member_id", memberIds)
      : { data: [] };

  const nicknameByMember = new Map<string, string>();
  for (const row of nicknameRows ?? []) {
    nicknameByMember.set(row.target_member_id, row.nickname);
  }

  // Pull each member's profile + open shift so the row can show "trabajando".
  const profileIds: string[] = [];
  const profileToMember = new Map<string, string>();
  for (const m of members ?? []) {
    const ep = Array.isArray(m.employee_profile)
      ? m.employee_profile[0]
      : (m.employee_profile as { id?: string } | null);
    if (ep?.id) {
      profileIds.push(ep.id);
      profileToMember.set(ep.id, m.id);
    }
  }

  const { data: openShifts } =
    profileIds.length > 0
      ? await supabase
          .from("time_entries")
          .select("employee_profile_id, clock_in")
          .eq("status", "open")
          .in("employee_profile_id", profileIds)
      : { data: [] };

  const openByMember = new Map<string, { clockIn: Date }>();
  for (const s of openShifts ?? []) {
    const memberId = profileToMember.get(s.employee_profile_id);
    if (memberId) {
      openByMember.set(memberId, { clockIn: new Date(s.clock_in) });
    }
  }

  const isEmployer = myMembership?.role === "employer";
  const isEmployee = myMembership?.role === "employee";
  const memberCount = members?.length ?? 0;
  const workingNow = openByMember.size;

  // Position count for the employer stats strip.
  const { count: positionsCount } = isEmployer
    ? await supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id)
    : { count: 0 };

  // Employee-only: fetch clock state + today's totals + recent shifts.
  let openShift: OpenShift | null = null;
  let recentShifts: RecentShift[] = [];
  let closedTodayMinutes = 0;

  if (isEmployee && myMembership) {
    // Sweep any expired shifts so subsequent reads are accurate.
    await supabase.rpc("auto_close_expired_shifts");

    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("id")
      .eq("group_member_id", myMembership.id)
      .maybeSingle();

    if (profile) {
      const [{ data: open }, { data: recent }, { data: todayEntries }] =
        await Promise.all([
          supabase
            .from("time_entries")
            .select("id, clock_in, expected_minutes")
            .eq("employee_profile_id", profile.id)
            .eq("status", "open")
            .maybeSingle(),
          supabase
            .from("time_entries")
            .select(
              "id, clock_in, clock_out, status, notes, verified_at, expected_minutes",
            )
            .eq("employee_profile_id", profile.id)
            .order("clock_in", { ascending: false })
            .limit(10),
          supabase
            .from("time_entries")
            .select("clock_in, clock_out, status")
            .eq("employee_profile_id", profile.id)
            .gte("clock_in", startOfTodayIso()),
        ]);

      openShift = open
        ? {
            id: open.id,
            clockInIso: open.clock_in,
            expectedMinutes: open.expected_minutes,
          }
        : null;

      recentShifts = (recent ?? []) as RecentShift[];

      closedTodayMinutes = (todayEntries ?? []).reduce<number>((sum, e) => {
        if (e.status === "open" || !e.clock_out) return sum;
        const ms =
          new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
        return sum + Math.max(0, Math.floor(ms / 60_000));
      }, 0);
    }
  }

  return (
    <div className="space-y-8">
      <nav aria-label="Migajas" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/app" className="hover:text-foreground">
              Tus grupos
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{group.name}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-6 shadow-sm shadow-black/5 backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-cyan-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={group.name} src={group.avatar_url} size="lg" />
            <div className="min-w-0">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {group.name}
                </span>
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant={isEmployer ? "accent" : "muted"}>
                  {isEmployer ? "Empleador" : "Empleado"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
                </span>
                {workingNow > 0 && (
                  <LiveBadge tone="emerald" size="sm">
                    {workingNow} trabajando
                  </LiveBadge>
                )}
              </div>
            </div>
          </div>

          {isEmployer && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/app/groups/${id}/invite`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Invitar
              </Link>
              <Link
                href={`/app/groups/${id}/positions`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <Briefcase className="h-4 w-4" aria-hidden />
                Roles
              </Link>
              <Link
                href={`/app/groups/${id}/settings`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                title="Configuración del grupo"
              >
                <SettingsIcon className="h-4 w-4" aria-hidden />
                Configuración
              </Link>
            </div>
          )}
        </div>

        {isEmployer && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
            <Stat
              label="Miembros"
              value={memberCount}
              icon={<Users className="h-3.5 w-3.5" aria-hidden />}
            />
            <Stat
              label="Trabajando"
              value={workingNow}
              icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
              accent={workingNow > 0}
            />
            <Stat
              label="Roles"
              value={positionsCount ?? 0}
              icon={<Briefcase className="h-3.5 w-3.5" aria-hidden />}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden />
            Miembros
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {memberCount}
            </span>
          </h2>
        </div>

        <MotionList className="grid gap-2.5">
          {members?.map((m) => {
            const nick = nicknameByMember.get(m.id);
            const shownName = nick ?? m.display_name;
            const realNameAside =
              nick && m.display_name && nick !== m.display_name
                ? m.display_name
                : null;

            const ep = Array.isArray(m.employee_profile)
              ? m.employee_profile[0]
              : (m.employee_profile as
                  | { position?: { name?: string } | { name?: string }[] | null }
                  | null);
            const positionRaw = ep?.position;
            const positionName = positionRaw
              ? Array.isArray(positionRaw)
                ? positionRaw[0]?.name
                : positionRaw.name
              : null;

            const open = openByMember.get(m.id);
            const subtitleParts: string[] = [];
            if (positionName) subtitleParts.push(positionName);
            if (realNameAside) subtitleParts.push(realNameAside);

            const inner = (
              <>
                <Avatar name={shownName ?? "?"} src={m.avatar_url} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {shownName ?? (
                        <span className="italic text-muted-foreground">
                          sin nombre
                        </span>
                      )}
                    </p>
                    {open && <LiveBadge size="sm">Trabajando</LiveBadge>}
                  </div>
                  {subtitleParts.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {subtitleParts.join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={m.role === "employer" ? "accent" : "muted"}>
                    {m.role === "employer" ? "Empleador" : "Empleado"}
                  </Badge>
                  {isEmployer && (
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  )}
                </div>
              </>
            );

            const rowBase =
              "group flex items-center gap-3.5 rounded-xl border border-border bg-surface/60 p-3.5 backdrop-blur-sm transition-all";
            const rowInteractive =
              "hover:border-border-strong hover:bg-surface-muted/40 hover:shadow-md hover:shadow-black/5";

            return (
              <MotionListItem key={m.id} hover={false}>
                {isEmployer ? (
                  <Link
                    href={`/app/groups/${id}/members/${m.id}`}
                    className={`${rowBase} ${rowInteractive}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className={rowBase}>{inner}</div>
                )}
              </MotionListItem>
            );
          })}
        </MotionList>
      </section>

      {isEmployee && (
        <>
          <ClockCard
            groupId={id}
            openShift={openShift}
            defaultExpectedHours={null}
            defaultExpectedExtraMinutes={null}
            closedTodayMinutes={closedTodayMinutes}
          />

          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mis turnos recientes
            </h2>
            <RecentShiftsList groupId={id} shifts={recentShifts} />
          </section>
        </>
      )}

      {isEmployer ? (
        <ComingSoonGrid
          title="Próximamente para empleadores"
          items={[
            {
              icon: <Clock className="h-4 w-4" aria-hidden />,
              title: "Verificación de turnos",
              description: "Aprobá los clock in/out al final del día.",
            },
            {
              icon: <Coins className="h-4 w-4" aria-hidden />,
              title: "Calcular pagos",
              description: "Total acumulado desde el último pago, listo para liquidar.",
            },
          ]}
        />
      ) : (
        <ComingSoonGrid
          title="Próximamente para empleados"
          items={[
            {
              icon: <Coins className="h-4 w-4" aria-hidden />,
              title: "Tu próximo pago",
              description: "Mirá las horas acumuladas y el monto estimado.",
            },
          ]}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border ${accent ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-surface-muted/30"} p-3`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function ComingSoonGrid({
  title,
  items,
}: {
  title: string;
  items: { icon: React.ReactNode; title: string; description: string }[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title} className="border-dashed">
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-surface-muted text-muted-foreground">
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
