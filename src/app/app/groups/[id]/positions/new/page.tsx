import { notFound, redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PositionForm } from "../position-form";
import { createPositionAction } from "./actions";

export default async function NewPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const action = createPositionAction.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Roles", href: `/app/groups/${id}/positions` },
          { label: "Nuevo rol" },
        ]}
        title="Nuevo rol"
        subtitle="Definí los defaults de un puesto. Los empleados con este rol heredan tarifa y montos fijos."
        icon={<Briefcase className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardBody>
          <PositionForm action={action} submitLabel="Crear rol" />
        </CardBody>
      </Card>
    </div>
  );
}
