import { notFound, redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { GroupAvatarUploader } from "./group-avatar-uploader";
import { GeofenceSection } from "./geofence-section";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select(
      "id, name, avatar_url, geofence_enabled, geofence_lat, geofence_lng, geofence_radius_m",
    )
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

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Configuración" },
        ]}
        title="Configuración del grupo"
        subtitle="Cambios visibles para todos los miembros del grupo."
        icon={<SettingsIcon className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardHeader>
          <CardTitle>Foto del grupo</CardTitle>
        </CardHeader>
        <CardBody>
          <GroupAvatarUploader
            groupId={id}
            groupName={group.name}
            currentUrl={group.avatar_url}
          />
        </CardBody>
      </Card>

      <GeofenceSection
        groupId={id}
        initialEnabled={!!group.geofence_enabled}
        initialLat={
          group.geofence_lat != null ? Number(group.geofence_lat) : null
        }
        initialLng={
          group.geofence_lng != null ? Number(group.geofence_lng) : null
        }
        initialRadius={
          group.geofence_radius_m != null
            ? Number(group.geofence_radius_m)
            : null
        }
      />
    </div>
  );
}
