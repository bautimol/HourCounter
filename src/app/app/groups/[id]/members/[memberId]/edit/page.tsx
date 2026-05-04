import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MemberEditForm,
  type MemberEditInitial,
  type PositionOption,
} from "./member-edit-form";
import { updateMemberAction } from "./actions";

export default async function EditMemberPage({
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
    .select("id, role, status, display_name")
    .eq("id", memberId)
    .eq("group_id", id)
    .maybeSingle();

  if (!member) notFound();
  if (member.role !== "employee") {
    redirect(`/app/groups/${id}/members/${memberId}`);
  }

  const { data: profile } = await supabase
    .from("employee_profiles")
    .select(
      "id, position_id, hourly_rate, payment_period, custom_period_days, currency",
    )
    .eq("group_member_id", memberId)
    .maybeSingle();

  const { data: positionRows } = await supabase
    .from("positions")
    .select(
      "id, name, hourly_rate, payment_period, custom_period_days, currency",
    )
    .eq("group_id", id)
    .order("name", { ascending: true });

  const positions: PositionOption[] = (positionRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    hourly_rate: Number(p.hourly_rate),
    payment_period: p.payment_period,
    custom_period_days: p.custom_period_days,
    currency: p.currency,
  }));

  const initial: MemberEditInitial = {
    displayName: member.display_name ?? "",
    positionId: profile?.position_id ?? null,
    hourlyRateOverride:
      profile?.hourly_rate != null ? String(profile.hourly_rate) : "",
    paymentPeriodOverride: profile?.payment_period ?? "",
    customPeriodDaysOverride:
      profile?.custom_period_days != null
        ? String(profile.custom_period_days)
        : "",
    currencyOverride: profile?.currency ?? "",
  };

  const action = updateMemberAction.bind(null, id, memberId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/app/groups/${id}/members/${memberId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {member.display_name ?? "Empleado"}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Editar empleado</CardTitle>
        </CardHeader>
        <CardBody>
          <MemberEditForm
            action={action}
            positions={positions}
            initial={initial}
          />
        </CardBody>
      </Card>
    </div>
  );
}
