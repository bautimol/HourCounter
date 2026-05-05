import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, Coins, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  fixedAmountFrequencyLabel,
  formatCurrency,
  paymentPeriodLabel,
} from "@/lib/format";
import { DeletePositionButton } from "./delete-position-button";

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string; positionId: string }>;
}) {
  const { id, positionId } = await params;
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

  const { data: position } = await supabase
    .from("positions")
    .select(
      "id, name, hourly_rate, payment_period, custom_period_days, currency, created_at",
    )
    .eq("id", positionId)
    .eq("group_id", id)
    .maybeSingle();

  if (!position) notFound();

  const { data: fixedAmounts } = await supabase
    .from("position_fixed_amounts")
    .select("id, description, amount, frequency, custom_days")
    .eq("position_id", positionId)
    .order("created_at", { ascending: true });

  const { data: profiles } = await supabase
    .from("employee_profiles")
    .select("id, group_member:group_members(id, display_name, status)")
    .eq("position_id", positionId);

  const activeProfiles = (profiles ?? []).filter((p) => {
    const gm = Array.isArray(p.group_member)
      ? p.group_member[0]
      : p.group_member;
    return gm?.status === "active";
  });

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Roles", href: `/app/groups/${id}/positions` },
          { label: position.name },
        ]}
        title={position.name}
        subtitle={`${formatCurrency(position.hourly_rate, position.currency)} / hora · ${paymentPeriodLabel(
          position.payment_period,
          position.custom_period_days,
        )}`}
        icon={<Briefcase className="h-5 w-5" aria-hidden />}
        accent="emerald"
        actions={
          <>
            <Link
              href={`/app/groups/${id}/positions/${positionId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-muted"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Link>
            <DeletePositionButton
              groupId={id}
              positionId={positionId}
              positionName={position.name}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" aria-hidden />
            Montos fijos ({fixedAmounts?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!fixedAmounts || fixedAmounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este rol no tiene montos fijos configurados.
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
                      {fixedAmountFrequencyLabel(fa.frequency, fa.custom_days)}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {formatCurrency(fa.amount, position.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Empleados con este rol ({activeProfiles.length})
        </h2>
        {activeProfiles.length === 0 ? (
          <Card className="border-dashed">
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Aún no hay empleados con este rol. Invitá a alguien y elegí este
              rol al generar el link.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {activeProfiles.map((p) => {
                const gm = Array.isArray(p.group_member)
                  ? p.group_member[0]
                  : p.group_member;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar name={gm?.display_name ?? "?"} size="sm" />
                    <span className="text-sm">
                      {gm?.display_name ?? (
                        <span className="text-muted-foreground italic">
                          sin nombre
                        </span>
                      )}
                    </span>
                    <Badge variant="muted" className="ml-auto">
                      Empleado
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
