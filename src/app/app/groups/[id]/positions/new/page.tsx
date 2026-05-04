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
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/app/groups/${id}/positions`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Roles
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo rol</CardTitle>
        </CardHeader>
        <CardBody>
          <PositionForm action={action} submitLabel="Crear rol" />
        </CardBody>
      </Card>
    </div>
  );
}
