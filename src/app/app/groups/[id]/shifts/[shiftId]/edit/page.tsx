import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, formatTimeOfDay } from "@/lib/format";
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

  // Hop through the joins, collapsing array vs object that the typings
  // produce when no DB types are generated.
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

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link
        href={`/app/groups/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {group.name}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Editar turno</CardTitle>
          <CardDescription>
            {formatShortDate(start)} · entrada a las {formatTimeOfDay(start)}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <EditShiftForm
            groupId={id}
            shiftId={shiftId}
            initialClockOutIso={shift.clock_out ?? new Date().toISOString()}
            initialNotes={shift.notes ?? ""}
            minIso={shift.clock_in}
          />
        </CardBody>
      </Card>
    </div>
  );
}
