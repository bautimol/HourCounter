import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarPlus,
  Coins,
  FileSpreadsheet,
  FileText,
  Pencil,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  conceptShortLabel,
  fixedAmountFrequencyLabel,
  formatCurrency,
  formatDuration,
  formatShortDate,
  paymentPeriodLabel,
} from "@/lib/format";
import { DeleteDayButton } from "./delete-day-button";

type EffectiveProfile = {
  id: string;
  group_member_id: string;
  position_id: string | null;
  hourly_rate: number;
  payment_period: string;
  custom_period_days: number | null;
  currency: string;
  hourly_rate_overridden: boolean;
  payment_period_overridden: boolean;
  currency_overridden: boolean;
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const supabase = await createClient();

  // Grouped into dependency waves so this screen costs 3 round trips instead
  // of one per query. Wave 1 is everything derivable from the URL alone.
  const [
    { data: group },
    {
      data: { user },
    },
    { data: member },
    { data: profileRow },
  ] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("group_members")
      .select("id, role, status, display_name, avatar_url, joined_at")
      .eq("id", memberId)
      .eq("group_id", id)
      .maybeSingle(),
    // Fetched before we know the role: employers simply have no profile row,
    // so this returns null for them rather than costing an extra wave for
    // every employee page.
    supabase
      .from("employee_profiles")
      .select("id, position_id, position:positions(name)")
      .eq("group_member_id", memberId)
      .maybeSingle(),
  ]);

  if (!group) notFound();

  // Wave 2 — both need the authenticated user from wave 1.
  const [{ data: myMembership }, { data: nicknameRow }] = await Promise.all([
    supabase
      .from("group_members")
      .select("role")
      .eq("group_id", id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    // Per-viewer nickname (only this employer sees it).
    supabase
      .from("member_nicknames")
      .select("nickname")
      .eq("viewer_user_id", user!.id)
      .eq("target_member_id", memberId)
      .maybeSingle(),
  ]);

  if (!myMembership || myMembership.role !== "employer") {
    redirect(`/app/groups/${id}`);
  }

  if (!member) notFound();

  const nickname = nicknameRow?.nickname ?? null;
  const titleName = nickname ?? member.display_name ?? "Empleado";

  let profile: {
    id: string;
    position_id: string | null;
    position_name: string | null;
  } | null = null;
  let effective: EffectiveProfile | null = null;
  let fixedAmounts: {
    id: string;
    description: string;
    amount: number;
    frequency: string;
    custom_days: number | null;
  }[] = [];
  let notes: string | null = null;
  let manualDays: {
    id: string;
    clock_in: string;
    clock_out: string | null;
    concept: string;
    notes: string | null;
  }[] = [];

  if (member.role === "employee" && profileRow) {
    const positionName = Array.isArray(profileRow.position)
      ? (profileRow.position[0]?.name ?? null)
      : ((profileRow.position as { name: string } | null)?.name ?? null);

    profile = {
      id: profileRow.id,
      position_id: profileRow.position_id,
      position_name: positionName,
    };

    // Wave 3 — the four reads that all hang off the profile id, in one hop.
    const [{ data: eff }, { data: fas }, { data: notesRow }, { data: manualRows }] =
      await Promise.all([
        supabase
          .rpc("effective_employee_profile", { profile_id: profileRow.id })
          .single(),
        supabase
          .from("fixed_amounts")
          .select("id, description, amount, frequency, custom_days")
          .eq("employee_profile_id", profileRow.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("employee_notes")
          .select("notes")
          .eq("employee_profile_id", profileRow.id)
          .maybeSingle(),
        // Days the employer typed in (holidays, vacation, forgotten shifts).
        // `created_by is not null` is what marks a row as manual.
        supabase
          .from("time_entries")
          .select("id, clock_in, clock_out, concept, notes")
          .eq("employee_profile_id", profileRow.id)
          .not("created_by", "is", null)
          .order("clock_in", { ascending: false })
          .limit(50),
      ]);

    effective = (eff as EffectiveProfile | null) ?? null;
    fixedAmounts = fas ?? [];
    notes = notesRow?.notes ?? null;
    manualDays = manualRows ?? [];
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
          <li>
            <Link
              href={`/app/groups/${id}`}
              className="hover:text-foreground"
            >
              {group.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{titleName}</li>
        </ol>
      </nav>

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-6 shadow-sm shadow-black/5 backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={titleName} src={member.avatar_url} size="lg" />
            <div className="min-w-0">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {titleName}
                </span>
              </h1>
              {nickname && member.display_name && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Nombre real: {member.display_name}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={member.role === "employer" ? "accent" : "muted"}>
                  {member.role === "employer" ? "Empleador" : "Empleado"}
                </Badge>
                {member.status === "archived" && (
                  <Badge variant="muted">Archivado</Badge>
                )}
                {profile?.position_name && (
                  <span className="text-xs text-muted-foreground">
                    {profile.position_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          {member.role === "employee" && member.status === "active" && (
            <div className="flex flex-wrap items-center gap-2">
              {profile && (
                <Link
                  href={`/app/groups/${id}/members/${memberId}/payments/new`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-sm shadow-emerald-700/25 ring-1 ring-inset ring-white/15 transition-opacity hover:opacity-90"
                >
                  <Receipt className="h-4 w-4" aria-hidden />
                  Liquidar pago
                </Link>
              )}
              {profile && (
                <Link
                  href={`/app/groups/${id}/members/${memberId}/days/new`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Agregar día
                </Link>
              )}
              {profile && (
                <Link
                  href={`/app/groups/${id}/members/${memberId}/report`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                  Reporte
                </Link>
              )}
              <Link
                href={`/app/groups/${id}/members/${memberId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {profile ? (
                  <>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" aria-hidden />
                    Configurar perfil
                  </>
                )}
              </Link>
            </div>
          )}
        </div>
      </section>

      {member.role === "employee" && profile && effective ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                Configuración efectiva
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0 space-y-3">
              <Row
                label="Tarifa por hora"
                value={formatCurrency(
                  effective.hourly_rate,
                  effective.currency,
                )}
                overridden={effective.hourly_rate_overridden}
                inheritedFrom={profile.position_name}
              />
              <Row
                label="Período de pago"
                value={paymentPeriodLabel(
                  effective.payment_period,
                  effective.custom_period_days,
                )}
                overridden={effective.payment_period_overridden}
                inheritedFrom={profile.position_name}
              />
              <Row
                label="Moneda"
                value={effective.currency}
                overridden={effective.currency_overridden}
                inheritedFrom={profile.position_name}
              />
              <div className="border-t border-border pt-3">
                <Link
                  href={`/app/groups/${id}/members/${memberId}/rate`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-soft-foreground hover:underline"
                >
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                  Cambiar tarifa con fecha de vigencia
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" aria-hidden />
                Montos fijos ({fixedAmounts.length})
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              {fixedAmounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este empleado no tiene montos fijos.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {fixedAmounts.map((fa) => (
                    <li
                      key={fa.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{fa.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {fixedAmountFrequencyLabel(
                            fa.frequency,
                            fa.custom_days,
                          )}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums">
                        {formatCurrency(fa.amount, effective.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                Días cargados a mano ({manualDays.length})
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              {manualDays.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no cargaste feriados ni vacaciones para este empleado.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {manualDays.map((d) => {
                    const day = new Date(d.clock_in);
                    const minutes = d.clock_out
                      ? new Date(d.clock_out).getTime() - day.getTime()
                      : 0;
                    const dayText = formatShortDate(day);
                    return (
                      <li
                        key={d.id}
                        className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            <span className="tabular-nums">{dayText}</span>
                            <Badge variant="muted">
                              {conceptShortLabel(d.concept)}
                            </Badge>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {formatDuration(minutes)}
                            {d.notes ? ` · ${d.notes}` : ""}
                          </p>
                        </div>
                        <DeleteDayButton
                          groupId={id}
                          memberId={memberId}
                          entryId={d.id}
                          dayLabel={`${conceptShortLabel(d.concept).toLowerCase()} del ${dayText}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-0">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {notes}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Visibles para los empleadores del grupo. El empleado no las
                  ve.
                </p>
              </CardBody>
            </Card>
          )}
        </>
      ) : member.role === "employee" ? (
        <Card className="border-dashed">
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            Este empleado todavía no tiene perfil de pago configurado. Tocá
            <strong className="mx-1 font-medium text-foreground">
              Configurar perfil
            </strong>
            para asignarle un rol o cargar valores manuales.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  overridden,
  inheritedFrom,
}: {
  label: string;
  value: string;
  overridden: boolean;
  inheritedFrom: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{value}</span>
        {overridden ? (
          <Badge variant="accent">Sobrescrito</Badge>
        ) : inheritedFrom ? (
          <Badge variant="muted">de {inheritedFrom}</Badge>
        ) : null}
      </div>
    </div>
  );
}
