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

  // Nickname is per-viewer; load only the current employer's row.
  const { data: nicknameRow } = await supabase
    .from("member_nicknames")
    .select("nickname")
    .eq("viewer_user_id", user!.id)
    .eq("target_member_id", memberId)
    .maybeSingle();

  // Notes + fixed amounts only exist if the profile does.
  const { data: notesRow } = profile
    ? await supabase
        .from("employee_notes")
        .select("notes")
        .eq("employee_profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const { data: fixedAmountRows } = profile
    ? await supabase
        .from("fixed_amounts")
        .select("description, amount, frequency, custom_days")
        .eq("employee_profile_id", profile.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const initial: MemberEditInitial = {
    displayName: member.display_name ?? "",
    nickname: nicknameRow?.nickname ?? "",
    notes: notesRow?.notes ?? "",
    positionId: profile?.position_id ?? null,
    hourlyRateOverride:
      profile?.hourly_rate != null ? String(profile.hourly_rate) : "",
    paymentPeriodOverride: profile?.payment_period ?? "",
    customPeriodDaysOverride:
      profile?.custom_period_days != null
        ? String(profile.custom_period_days)
        : "",
    currencyOverride: profile?.currency ?? "",
    fixedAmounts: (fixedAmountRows ?? []).map((fa) => ({
      description: fa.description,
      amount: String(fa.amount),
      frequency: fa.frequency,
      customDays: fa.custom_days != null ? String(fa.custom_days) : "",
    })),
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
