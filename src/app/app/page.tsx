import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function AppHomePage() {
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("role, joined_at, group:groups(id, name, created_at)")
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tus grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Espacios donde sos empleador o empleado.
          </p>
        </div>
        <Link href="/app/groups/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            Crear grupo
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-danger/40">
          <div className="px-5 py-4 text-sm text-danger">
            Error cargando los grupos: {error.message}
          </div>
        </Card>
      )}

      {!error && (!memberships || memberships.length === 0) && (
        <Card>
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-muted">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Todavía no hay grupos</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Creá uno para empezar, o pedile a alguien que te invite.
              </p>
            </div>
            <Link href="/app/groups/new" className="mt-1">
              <Button>
                <Plus className="h-4 w-4" aria-hidden />
                Crear primer grupo
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {memberships && memberships.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => {
            const group = Array.isArray(m.group) ? m.group[0] : m.group;
            if (!group) return null;
            return (
              <li key={group.id}>
                <Link href={`/app/groups/${group.id}`} className="block">
                  <Card className="group transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={group.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{group.name}</p>
                          <Badge
                            variant={m.role === "employer" ? "accent" : "muted"}
                            className="mt-1"
                          >
                            {m.role === "employer" ? "Empleador" : "Empleado"}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
