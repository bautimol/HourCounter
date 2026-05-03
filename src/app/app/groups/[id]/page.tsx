import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  ChevronLeft,
  Clock,
  Coins,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, created_at")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    return (
      <p className="text-sm text-danger">
        Error cargando el grupo: {groupError.message}
      </p>
    );
  }

  if (!group) {
    notFound();
  }

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .single();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, role, display_name, joined_at, user_id")
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  const isEmployer = myMembership?.role === "employer";
  const memberCount = members?.length ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Tus grupos
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={group.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {group.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={isEmployer ? "accent" : "muted"}>
              {isEmployer ? "Empleador" : "Empleado"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {memberCount} {memberCount === 1 ? "miembro" : "miembros"}
            </span>
          </div>
        </div>
      </div>

      {isEmployer && (
        <nav className="flex flex-wrap gap-2">
          <Link
            href={`/app/groups/${id}/invite`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-muted"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Invitar
          </Link>
          <Link
            href={`/app/groups/${id}/positions`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-muted"
          >
            <Briefcase className="h-4 w-4" aria-hidden />
            Roles
          </Link>
        </nav>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            Miembros
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <ul className="divide-y divide-border">
            {members?.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.display_name ?? "?"} size="sm" />
                  <span className="truncate text-sm">
                    {m.display_name ?? (
                      <span className="text-muted-foreground italic">
                        sin nombre
                      </span>
                    )}
                  </span>
                </div>
                <Badge variant={m.role === "employer" ? "accent" : "muted"}>
                  {m.role === "employer" ? "Empleador" : "Empleado"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {isEmployer ? (
        <ComingSoonGrid
          title="Próximamente para empleadores"
          items={[
            {
              icon: <Clock className="h-4 w-4" aria-hidden />,
              title: "Verificación de turnos",
              description: "Aprobá los clock in/out al final del día.",
            },
            {
              icon: <Coins className="h-4 w-4" aria-hidden />,
              title: "Calcular pagos",
              description: "Total acumulado desde el último pago, listo para liquidar.",
            },
          ]}
        />
      ) : (
        <ComingSoonGrid
          title="Próximamente para empleados"
          items={[
            {
              icon: <Clock className="h-4 w-4" aria-hidden />,
              title: "Clock in / out",
              description: "Registrá la entrada y la salida desde el celular.",
            },
            {
              icon: <Coins className="h-4 w-4" aria-hidden />,
              title: "Tu próximo pago",
              description: "Mirá las horas acumuladas y el monto estimado.",
            },
          ]}
        />
      )}
    </div>
  );
}

function ComingSoonGrid({
  title,
  items,
}: {
  title: string;
  items: { icon: React.ReactNode; title: string; description: string }[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title} className="border-dashed">
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-surface-muted text-muted-foreground">
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
