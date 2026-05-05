import { User2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DisplayNameForm } from "./display-name-form";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pick the most recently joined group's display_name as the canonical
  // current value to show. They're all updated together when saved.
  const { data: memberships } = await supabase
    .from("group_members")
    .select("display_name, joined_at")
    .eq("user_id", user!.id)
    .order("joined_at", { ascending: false })
    .limit(1);

  const current =
    memberships?.[0]?.display_name ??
    (user!.user_metadata?.full_name as string | undefined) ??
    user!.email ??
    "";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <PageHeader
        crumbs={[{ label: "Tus grupos", href: "/app" }, { label: "Tu perfil" }]}
        title="Tu perfil"
        subtitle="Tu nombre se actualiza en todos los grupos a la vez."
        icon={<User2 className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardBody>
          <DisplayNameForm current={current} />
        </CardBody>
      </Card>
    </div>
  );
}
