import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck, MapPin, MapPinOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  formatDuration,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/format";
import { ShiftReviewForm } from "./shift-review-form";
import { UnverifyShiftButton } from "./unverify-shift-button";

type Member = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ShiftRow = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: "open" | "closed" | "needs_review";
  notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  expected_minutes: number | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  within_geofence: boolean | null;
  employee_profile: {
    group_member: Member | Member[] | null;
  } | null;
};

export default async function ShiftReviewPage({
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

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!myMembership || myMembership.role !== "employer") {
    redirect(`/app/groups/${id}`);
  }

  const { data: rawShift } = await supabase
    .from("time_entries")
    .select(
      `id, clock_in, clock_out, status, notes, verified_at, verified_by,
       expected_minutes, clock_in_lat, clock_in_lng, within_geofence,
       employee_profile:employee_profiles!inner(
         group_member:group_members!inner(
           id, display_name, avatar_url, group_id
         )
       )`,
    )
    .eq("id", shiftId)
    .maybeSingle();

  const shift = rawShift as unknown as ShiftRow | null;
  if (!shift) notFound();

  const memberRaw = shift.employee_profile?.group_member ?? null;
  const member = (
    Array.isArray(memberRaw) ? memberRaw[0] : memberRaw
  ) as Member | null;
  if (!member) notFound();

  // The RLS join constraint already scoped this to the right group, but
  // double-check defensively.
  const memberWithGroup = member as Member & { group_id?: string };
  if (memberWithGroup.group_id && memberWithGroup.group_id !== id) {
    notFound();
  }

  const start = new Date(shift.clock_in);
  const end = shift.clock_out ? new Date(shift.clock_out) : null;
  const durationMs =
    end != null ? end.getTime() - start.getTime() : null;
  const verified = shift.verified_at != null;

  const memberName = member.display_name ?? "Empleado";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Turnos", href: `/app/groups/${id}/shifts` },
          { label: memberName },
        ]}
        title="Revisar turno"
        subtitle={`${formatShortDate(start)} · entrada a las ${formatTimeOfDay(start)}`}
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      {/* Employee summary card */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={memberName}
              src={member.avatar_url}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-base font-medium">{memberName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatTimeOfDay(start)}
                {" – "}
                {end ? formatTimeOfDay(end) : "abierto"}
                {durationMs != null
                  ? ` · ${formatDuration(durationMs)}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {verified ? (
              <Badge variant="accent">
                <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
                Verificado
              </Badge>
            ) : shift.status === "needs_review" ? (
              <Badge variant="muted">Para revisar</Badge>
            ) : (
              <Badge variant="muted">Pendiente</Badge>
            )}
            <Link
              href={`/app/groups/${id}/members/${member.id}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Perfil →
            </Link>
          </div>
        </CardHeader>
        {(shift.notes || shift.within_geofence !== null) && (
          <CardBody className="space-y-3 pt-0">
            {shift.within_geofence !== null && (
              <GeofenceBanner
                within={shift.within_geofence}
                lat={shift.clock_in_lat}
                lng={shift.clock_in_lng}
              />
            )}
            {shift.notes && (
              <p className="rounded-md border border-border bg-surface-muted/40 p-3 text-sm italic text-muted-foreground">
                {shift.notes}
              </p>
            )}
          </CardBody>
        )}
      </Card>

      {/* Review form */}
      <Card>
        <CardHeader>
          <CardTitle>Editar y aprobar</CardTitle>
        </CardHeader>
        <CardBody>
          <ShiftReviewForm
            groupId={id}
            shiftId={shiftId}
            alreadyVerified={verified}
            initialClockOutIso={
              shift.clock_out ?? new Date().toISOString()
            }
            initialNotes={shift.notes ?? ""}
            initialStatus={shift.status}
            minIso={shift.clock_in}
          />
        </CardBody>
      </Card>

      {verified && (
        <div className="flex justify-end">
          <UnverifyShiftButton groupId={id} shiftId={shiftId} />
        </div>
      )}
    </div>
  );
}

function GeofenceBanner({
  within,
  lat,
  lng,
}: {
  within: boolean;
  lat: number | null;
  lng: number | null;
}) {
  if (within) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        Fichó dentro del radio configurado.
        {lat != null && lng != null && (
          <a
            target="_blank"
            rel="noreferrer noopener"
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            className="ml-auto underline"
          >
            Ver en mapa
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
      <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="flex-1">
        Fichó <strong>fuera del radio</strong>{" "}
        {lat == null || lng == null
          ? "(o sin compartir ubicación)"
          : "configurado"}
        .
        {lat != null && lng != null && (
          <a
            target="_blank"
            rel="noreferrer noopener"
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            className="ml-2 underline"
          >
            Ver en mapa
          </a>
        )}
      </div>
    </div>
  );
}
