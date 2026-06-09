import { History } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AR_TIME_ZONE, formatTimeOfDay } from "@/lib/format";

export type AuditEntry = {
  id: string;
  edited_at: string;
  field: "clock_out" | "notes" | "status" | "verified";
  before_value: string | null;
  after_value: string | null;
  editor: {
    display_name: string | null;
  } | null;
};

export function ShiftAuditLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          Historial de cambios
        </CardTitle>
      </CardHeader>
      <CardBody className="pt-0">
        <ol className="space-y-3">
          {entries.map((e) => {
            const editorName = e.editor?.display_name ?? "Alguien";
            const at = new Date(e.edited_at);
            return (
              <li key={e.id} className="flex items-start gap-3">
                <Avatar name={editorName} size="sm" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-medium">{editorName}</span>{" "}
                    <span className="text-muted-foreground">
                      {describeEdit(e.field, e.before_value, e.after_value)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {at.toLocaleString("es-AR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: AR_TIME_ZONE,
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

function describeEdit(
  field: AuditEntry["field"],
  before: string | null,
  after: string | null,
): string {
  if (field === "verified") {
    if (after === "verified") return "aprobó el turno";
    if (before === "verified") return "desaprobó el turno";
    return "cambió el estado de aprobación";
  }

  if (field === "status") {
    return `cambió el estado de "${labelStatus(before)}" a "${labelStatus(after)}"`;
  }

  if (field === "clock_out") {
    if (before == null) {
      return after == null
        ? "tocó la hora de salida"
        : `puso la hora de salida en ${formatIsoAsTime(after)}`;
    }
    if (after == null) return `borró la hora de salida (era ${formatIsoAsTime(before)})`;
    return `cambió la hora de salida de ${formatIsoAsTime(before)} a ${formatIsoAsTime(after)}`;
  }

  if (field === "notes") {
    if (before == null && after != null) {
      return `agregó nota: "${truncate(after)}"`;
    }
    if (before != null && after == null) return "borró la nota";
    if (before != null && after != null) {
      return `cambió la nota a "${truncate(after)}"`;
    }
    return "cambió la nota";
  }

  return "modificó el turno";
}

function labelStatus(s: string | null): string {
  switch (s) {
    case "open":
      return "abierto";
    case "closed":
      return "cerrado";
    case "needs_review":
      return "para revisar";
    default:
      return s ?? "—";
  }
}

function formatIsoAsTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatTimeOfDay(d);
}

function truncate(s: string, max = 80): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
