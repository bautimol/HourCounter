import { User2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DisplayNameForm } from "./display-name-form";
import { AvatarUploader } from "./avatar-uploader";
import { PushSection } from "./push-section";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pick the most recently joined group's display_name + avatar_url as the
  // canonical current values to show. They're all updated together.
  const { data: memberships } = await supabase
    .from("group_members")
    .select("display_name, avatar_url, joined_at")
    .eq("user_id", user!.id)
    .order("joined_at", { ascending: false })
    .limit(1);

  const currentName =
    memberships?.[0]?.display_name ??
    (user!.user_metadata?.full_name as string | undefined) ??
    user!.email ??
    "";

  const currentAvatarUrl = memberships?.[0]?.avatar_url ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        crumbs={[{ label: "Tus grupos", href: "/app" }, { label: "Tu perfil" }]}
        title="Tu perfil"
        subtitle="Tu nombre y foto se actualizan en todos los grupos a la vez."
        icon={<User2 className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
        </CardHeader>
        <CardBody>
          <AvatarUploader currentUrl={currentAvatarUrl} name={currentName} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nombre</CardTitle>
        </CardHeader>
        <CardBody>
          <DisplayNameForm current={currentName} />
        </CardBody>
      </Card>

      <PushSection
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      />
    </div>
  );
}
