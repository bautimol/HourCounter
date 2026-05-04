import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateInvitationForm } from "./create-invitation-form";

export default async function InvitePage({
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

  const [{ data: positions }, { data: invitations }] = await Promise.all([
    supabase
      .from("positions")
      .select("id, name")
      .eq("group_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("invitations")
      .select(
        "id, code, role, position_id, expires_at, used_at, used_by, created_at, position:positions(name)",
      )
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-6">
      <Link
        href={`/app/groups/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {group.name}
      </Link>

      <div className="flex items-center gap-3">
        <Avatar name={group.name} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Invitar al grupo
          </h1>
          <p className="text-sm text-muted-foreground">{group.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar nueva invitación</CardTitle>
        </CardHeader>
        <CardBody>
          <CreateInvitationForm
            groupId={id}
            origin={origin}
            positions={positions ?? []}
          />
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invitaciones recientes ({invitations?.length ?? 0})
        </h2>

        {!invitations || invitations.length === 0 ? (
          <Card className="border-dashed">
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              Aún no creaste ninguna invitación.
            </p>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {invitations.map((inv) => {
                const used = inv.used_at != null;
                const expired =
                  inv.expires_at != null &&
                  new Date(inv.expires_at) < new Date();
                const link = `${origin}/invite/${inv.code}`;
                const positionName = Array.isArray(inv.position)
                  ? inv.position[0]?.name
                  : (inv.position as { name?: string } | null)?.name;

                return (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-mono">
                          {inv.code}
                        </code>
                        <Badge
                          variant={inv.role === "employer" ? "accent" : "muted"}
                        >
                          {inv.role === "employer" ? "Empleador" : "Empleado"}
                        </Badge>
                        {positionName && (
                          <Badge variant="neutral">{positionName}</Badge>
                        )}
                        {used && <Badge variant="muted">Usada</Badge>}
                        {!used && expired && (
                          <Badge variant="muted">Expirada</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {link}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {inv.expires_at
                        ? new Date(inv.expires_at).toLocaleDateString("es-AR")
                        : "Sin vencimiento"}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
