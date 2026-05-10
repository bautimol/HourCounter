import { notFound, redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  formatDuration,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/format";
import { EditShiftForm } from "./edit-shift-form";

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string; shiftId: string }>;
}) {
  const { id, shiftId } = await params;
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

  // Fetch the shift and ensure it belongs to me, in this group, and isn't
  // verified yet. The select via the joined member is what RLS will allow.
  const { data: shift } = await supabase
    .from("time_entries")
    .select(
      `id, clock_in, clock_out, status, notes, verified_at,
       employee_profile:employee_profiles!inner(
         id,
         group_member:group_members!inner(group_id, user_id)
       )`,
    )
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift) notFound();

  const ep = Array.isArray(shift.employee_profile)
    ? shift.employee_profile[0]
    : shift.employee_profile;
  const gm = ep
    ? Array.isArray(ep.group_member)
      ? ep.group_member[0]
      : ep.group_member
    : null;

  if (!gm || gm.group_id !== id || gm.user_id !== user?.id) {
    notFound();
  }
  if (shift.status === "open") {
    redirect(`/app/groups/${id}`);
  }
  if (shift.verified_at != null) {
    redirect(`/app/groups/${id}`);
  }

  const start = new Date(shift.clock_in);
  const end = shift.clock_out ? new Date(shift.clock_out) : null;
  const durationMs =
    end != null ? end.getTime() - start.getTime() : null;

  return (
    <div className="mx-auto max-w-md space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Nota del turno" },
        ]}
        title="Agregar nota al turno"
        subtitle={`${formatShortDate(start)} · entrada a las ${formatTimeOfDay(start)}`}
        icon={<MessageSquare className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      {/* Read-only context: the recorded times. The employee can no longer
          edit clock_out — they leave a note and the employer adjusts. */}
      <Card>
        <CardBody className="space-y-2 py-4 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Entrada</span>
            <span className="tabular-nums">
              {formatTimeOfDay(start)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Salida</span>
            <span className="tabular-nums">
              {end ? formatTimeOfDay(end) : "—"}
            </span>
          </div>
          {durationMs != null && (
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums">
                {formatDuration(durationMs)}
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <EditShiftForm
            groupId={id}
            shiftId={shiftId}
            initialNotes={shift.notes ?? ""}
          />
        </CardBody>
      </Card>
    </div>
  );
}
