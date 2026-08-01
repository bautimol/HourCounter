import { notFound, redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { AR_TIME_ZONE } from "@/lib/format";
import { AddDayForm } from "./add-day-form";

export default async function NewDayPage({
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
    .select("id, role, display_name, avatar_url, group_id")
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

  if (!profile) {
    // No profile = no rate, nothing to pay the day against. Configure first.
    redirect(`/app/groups/${id}/members/${memberId}/edit`);
  }

  const memberName = member.display_name ?? "Empleado";

  // "Today" has to be resolved in Argentina, not in the server's UTC, or the
  // date defaults to tomorrow for anyone loading a day after 21:00 ART.
  const defaultDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: memberName, href: `/app/groups/${id}/members/${memberId}` },
          { label: "Agregar día" },
        ]}
        title="Agregar día"
        subtitle="Días que se pagan aunque no se fichen: feriados, vacaciones, o un turno que quedó sin registrar."
        icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Avatar
              name={memberName}
              src={member.avatar_url ?? null}
              size="sm"
            />
            {memberName}
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <AddDayForm
            groupId={id}
            memberId={memberId}
            profileId={profile.id}
            defaultDate={defaultDate}
          />
        </CardBody>
      </Card>
    </div>
  );
}
