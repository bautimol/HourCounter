import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatCurrency,
  paymentPeriodLabel,
} from "@/lib/format";

export default async function PositionsListPage({
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

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .single();

  if (!myMembership || myMembership.role !== "employer") {
    redirect(`/app/groups/${id}`);
  }

  const { data: positions } = await supabase
    .from("positions")
    .select(
      "id, name, hourly_rate, payment_period, custom_period_days, currency, created_at",
    )
    .eq("group_id", id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <Link
        href={`/app/groups/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {group.name}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plantillas de empleado del grupo (tarifa, período de pago,
            adicionales fijos).
          </p>
        </div>
        <Link href={`/app/groups/${id}/positions/new`}>
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo rol
          </Button>
        </Link>
      </div>

      {!positions || positions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-muted">
              <Briefcase
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </span>
            <div>
              <p className="font-medium">Todavía no creaste ningún rol</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Por ejemplo: <em>Cajero</em>, <em>Cocinero</em>,{" "}
                <em>Repartidor</em>.
              </p>
            </div>
            <Link href={`/app/groups/${id}/positions/new`} className="mt-1">
              <Button>
                <Plus className="h-4 w-4" aria-hidden />
                Crear primer rol
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {positions.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/groups/${id}/positions/${p.id}`}
                className="block"
              >
                <Card className="group transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(p.hourly_rate, p.currency)} / hora ·{" "}
                        {paymentPeriodLabel(
                          p.payment_period,
                          p.custom_period_days,
                        )}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
