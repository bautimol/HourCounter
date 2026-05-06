import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PageHeader } from "@/components/page-header";
import { MotionList, MotionListItem } from "@/components/motion-list";
import { formatCurrency, paymentPeriodLabel } from "@/lib/format";

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

  const { data: positions } = await supabase
    .from("positions")
    .select(
      "id, name, hourly_rate, payment_period, custom_period_days, currency, created_at",
    )
    .eq("group_id", id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Roles" },
        ]}
        title="Roles"
        subtitle="Plantillas de empleado del grupo (tarifa, período de pago, adicionales fijos)."
        icon={<Briefcase className="h-5 w-5" aria-hidden />}
        accent="emerald"
        actions={
          <Link href={`/app/groups/${id}/positions/new`}>
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo rol
            </Button>
          </Link>
        }
      />

      {!positions || positions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
              <Briefcase className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-medium">
                Todavía no creaste ningún rol
              </p>
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
        <MotionList className="grid gap-3 sm:grid-cols-2">
          {positions.map((p) => (
            <MotionListItem key={p.id}>
              <Link
                href={`/app/groups/${id}/positions/${p.id}`}
                className="block"
              >
                <SpotlightCard tint="emerald">
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-medium">{p.name}</p>
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
                </SpotlightCard>
              </Link>
            </MotionListItem>
          ))}
        </MotionList>
      )}
    </div>
  );
}
