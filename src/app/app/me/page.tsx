import Link from "next/link";
import { ChevronLeft, User2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Tus grupos
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Tu perfil
          </CardTitle>
        </CardHeader>
        <CardBody>
          <DisplayNameForm current={current} />
        </CardBody>
      </Card>
    </div>
  );
}
