import Link from "next/link";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MotionList, MotionListItem } from "@/components/motion-list";
import {
  conceptLabel,
  formatDuration,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/format";

export type RecentShift = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: "open" | "closed" | "needs_review";
  notes: string | null;
  verified_at: string | null;
  expected_minutes: number | null;
  /** "worked" = clocked by the employee; anything else the employer loaded. */
  concept: string;
};

export function RecentShiftsList({
  groupId,
  shifts,
}: {
  groupId: string;
  shifts: RecentShift[];
}) {
  if (shifts.length === 0) {
    return (
      <Card className="border-dashed">
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          Todavía no registraste turnos en este grupo.
        </p>
      </Card>
    );
  }

  return (
    <MotionList className="grid gap-2.5">
      {shifts.map((s) => {
        const start = new Date(s.clock_in);
        const end = s.clock_out ? new Date(s.clock_out) : null;
        const durationMs =
          end != null ? end.getTime() - start.getTime() : null;
        const verified = s.verified_at != null;
        const editable = s.status !== "open" && !verified;
        const worked = s.concept === "worked";

        return (
          <MotionListItem key={s.id} hover={false}>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                {worked ? (
                  <>
                    <p className="text-sm font-medium">
                      {formatShortDate(start)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTimeOfDay(start)}
                      {" – "}
                      {end ? formatTimeOfDay(end) : "abierto"}
                      {durationMs != null
                        ? ` · ${formatDuration(durationMs)}`
                        : ""}
                    </p>
                  </>
                ) : (
                  // A non-worked day has no real time range: the 09:00–17:00 is
                  // synthesized when the employer loads it (see migration 0026).
                  // Showing it would tell the employee she worked hours she
                  // never worked, so we lead with the concept and its hours.
                  <>
                    <p className="text-sm font-medium">
                      {conceptLabel(s.concept)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatShortDate(start)}
                      {durationMs != null
                        ? ` · ${formatDuration(durationMs)} pagadas`
                        : ""}
                    </p>
                  </>
                )}
                {s.notes && (
                  <p className="truncate text-xs italic text-muted-foreground">
                    {s.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-soft-foreground">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Verificado
                  </span>
                )}
                {editable && (
                  <Link
                    href={`/app/groups/${groupId}/shifts/${s.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground transition-colors hover:bg-surface-muted"
                    title="Si la hora está mal, dejá una nota para tu empleador"
                  >
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    {s.notes ? "Editar nota" : "Agregar nota"}
                  </Link>
                )}
              </div>
            </div>
          </MotionListItem>
        );
      })}
    </MotionList>
  );
}
