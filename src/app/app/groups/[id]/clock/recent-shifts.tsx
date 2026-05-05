import Link from "next/link";
import { Pencil, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MotionList, MotionListItem } from "@/components/motion-list";
import {
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

        return (
          <MotionListItem key={s.id} hover={false}>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">{formatShortDate(start)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTimeOfDay(start)}
                  {" – "}
                  {end ? formatTimeOfDay(end) : "abierto"}
                  {durationMs != null ? ` · ${formatDuration(durationMs)}` : ""}
                </p>
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
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    Editar
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
