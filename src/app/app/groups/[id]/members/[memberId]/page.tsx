import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Coins,
  FileText,
  Pencil,
  ScrollText,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fixedAmountFrequencyLabel,
  formatCurrency,
  paymentPeriodLabel,
} from "@/lib/format";

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
    .select("id, role, status, display_name, joined_at")
    .eq("id", memberId)
    .eq("group_id", id)
    .maybeSingle();

  if (!member) notFound();

  // Per-viewer nickname (only this employer sees it).
  const { data: nicknameRow } = await supabase
    .from("member_nicknames")
    .select("nickname")
    .eq("viewer_user_id", user!.id)
    .eq("target_member_id", memberId)
    .maybeSingle();
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

  if (member.role === "employee") {
    const { data: profileRow } = await supabase
      .from("employee_profiles")
      .select("id, position_id, position:positions(name)")
      .eq("group_member_id", memberId)
      .maybeSingle();

    if (profileRow) {
      const positionName = Array.isArray(profileRow.position)
        ? (profileRow.position[0]?.name ?? null)
        : ((profileRow.position as { name: string } | null)?.name ?? null);

      profile = {
        id: profileRow.id,
        position_id: profileRow.position_id,
        position_name: positionName,
      };

      const { data: eff } = await supabase
        .rpc("effective_employee_profile", { profile_id: profileRow.id })
        .single();

      effective = (eff as EffectiveProfile | null) ?? null;

      const { data: fas } = await supabase
        .from("fixed_amounts")
        .select("id, description, amount, frequency, custom_days")
        .eq("employee_profile_id", profileRow.id)
        .order("created_at", { ascending: true });

      fixedAmounts = fas ?? [];

      const { data: notesRow } = await supabase
        .from("employee_notes")
        .select("notes")
        .eq("employee_profile_id", profileRow.id)
        .maybeSingle();

      notes = notesRow?.notes ?? null;
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
            <Avatar name={titleName} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {titleName}
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
