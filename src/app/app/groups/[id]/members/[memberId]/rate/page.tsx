import { notFound, redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { AR_TIME_ZONE } from "@/lib/format";
import { RateForm } from "./rate-form";

type EffectiveProfile = {
  hourly_rate: number | null;
  currency: string | null;
};

export default async function ChangeRatePage({
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
    .select("id, role, display_name")
    .eq("id", memberId)
    .eq("group_id", id)
    .maybeSingle();
  if (!member) notFound();
  if (member.role !== "employee") {
    redirect(`/app/groups/${id}/members/${memberId}`);
  }

  const { data: profile } = await supabase
    .from("employee_profiles")
    .select("id")
    .eq("group_member_id", memberId)
    .maybeSingle();

  // No profile yet → nothing to reprice; send them to the editor to set it up.
  if (!profile) {
    redirect(`/app/groups/${id}/members/${memberId}/edit`);
  }

  const { data: eff } = await supabase
    .rpc("effective_employee_profile", { profile_id: profile.id })
    .single();
  const effective = (eff as EffectiveProfile | null) ?? null;

  const memberName = member.display_name ?? "Empleado";
  const today = arTodayStr();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          {
            label: memberName,
            href: `/app/groups/${id}/members/${memberId}`,
          },
          { label: "Cambiar tarifa" },
        ]}
        title="Cambiar tarifa por hora"
        subtitle="Elegí desde qué fecha vale la nueva tarifa; los turnos anteriores mantienen la actual."
        icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardBody>
          <RateForm
            groupId={id}
            memberId={memberId}
            profileId={profile.id}
            currentRate={
              effective?.hourly_rate != null
                ? Number(effective.hourly_rate)
                : null
            }
            currency={effective?.currency ?? "ARS"}
            today={today}
          />
        </CardBody>
      </Card>
    </div>
  );
}

/** Current Y-M-D in Argentina as "YYYY-MM-DD". */
function arTodayStr(): string {
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
  return `${parts.year}-${parts.month}-${parts.day}`;
}
