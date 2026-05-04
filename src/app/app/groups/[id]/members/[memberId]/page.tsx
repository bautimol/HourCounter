import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Coins, Pencil, ScrollText } from "lucide-react";
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

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .single();

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

  // For employee members, load profile + effective values + fixed amounts.
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
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/app/groups/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {group.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar name={member.display_name ?? "?"} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {member.display_name ?? (
                <span className="italic text-muted-foreground">sin nombre</span>
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
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
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-muted"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar
          </Link>
        )}
      </div>

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
        </>
      ) : member.role === "employee" ? (
        <Card className="border-dashed">
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            Este empleado todavía no tiene perfil de pago configurado.
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
