import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PageHeader } from "@/components/page-header";
import { MotionList, MotionListItem } from "@/components/motion-list";
import {
  OpenShiftBanner,
  type OpenShiftSummary,
} from "./open-shift-banner";

type OpenShiftRow = {
  id: string;
  clock_in: string;
  employee_profile: {
    group_member: {
      group_id: string;
      user_id: string;
      group: {
        id: string;
        name: string;
        avatar_url: string | null;
      } | null;
    } | null;
  } | null;
};

export default async function AppHomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sweep stale shifts so a banner never shows for a shift that should have
  // auto-closed by now.
  await supabase.rpc("auto_close_expired_shifts");

  const { data: memberships, error } = await supabase
    .from("group_members")
    .select(
      "role, joined_at, group:groups(id, name, avatar_url, created_at)",
    )
    .eq("user_id", user!.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  // Open shifts across every group the user belongs to. Drives the
  // global "Trabajando en X" banner above the groups list.
  const { data: rawOpen } = await supabase
    .from("time_entries")
    .select(
      `id, clock_in,
       employee_profile:employee_profiles!inner(
         group_member:group_members!inner(
           group_id, user_id,
           group:groups(id, name, avatar_url)
         )
       )`,
    )
    .eq("status", "open")
    .eq("employee_profile.group_member.user_id", user!.id);

  const openShifts: OpenShiftSummary[] = ((rawOpen ?? []) as unknown as OpenShiftRow[])
    .map((row) => {
      const ep = Array.isArray(row.employee_profile)
        ? row.employee_profile[0]
        : row.employee_profile;
      const gm = ep
        ? Array.isArray(ep.group_member)
          ? ep.group_member[0]
          : ep.group_member
        : null;
      const group = gm
        ? Array.isArray(gm.group)
          ? gm.group[0]
          : gm.group
        : null;
      if (!group) return null;
      return {
        shiftId: row.id,
        groupId: group.id,
        groupName: group.name,
        groupAvatarUrl: group.avatar_url ?? null,
        clockInIso: row.clock_in,
      };
    })
    .filter((x): x is OpenShiftSummary => x !== null);

  return (
    <div className="space-y-8">
      <OpenShiftBanner shifts={openShifts} />

      <PageHeader
        title={
          <span>
            Tus{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
              grupos
            </span>
          </span>
        }
        subtitle="Espacios donde sos empleador o empleado."
        icon={<Users className="h-5 w-5" aria-hidden />}
        accent="emerald"
        actions={
          <Link href="/app/groups/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              Crear grupo
            </Button>
          </Link>
        }
      />

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
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-medium">Todavía no hay grupos</p>
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
        <MotionList className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => {
            const group = Array.isArray(m.group) ? m.group[0] : m.group;
            if (!group) return null;
            return (
              <MotionListItem key={group.id}>
                <Link href={`/app/groups/${group.id}`} className="block">
                  <SpotlightCard tint="emerald">
                    <div className="flex items-center justify-between gap-3 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={group.name}
                          src={
                            (group as { avatar_url?: string | null })
                              .avatar_url ?? null
                          }
                          size="lg"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium">
                            {group.name}
                          </p>
                          <Badge
                            variant={m.role === "employer" ? "accent" : "muted"}
                            className="mt-1.5"
                          >
                            {m.role === "employer" ? "Empleador" : "Empleado"}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </SpotlightCard>
                </Link>
              </MotionListItem>
            );
          })}
        </MotionList>
      )}
    </div>
  );
}
