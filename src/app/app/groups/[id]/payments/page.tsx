import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MotionList, MotionListItem } from "@/components/motion-list";
import { AR_TIME_ZONE, formatCurrency, formatShortDate } from "@/lib/format";

type PaymentRow = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  paid_at: string;
  employee_profile: {
    currency: string | null;
    group_member: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      group_id: string;
    } | null;
  } | null;
};

export default async function PaymentsListPage({
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

  const { data: rawPayments } = await supabase
    .from("payments")
    .select(
      `id, period_start, period_end, total_amount, paid_at,
       employee_profile:employee_profiles!inner(
         currency,
         group_member:group_members!inner(id, display_name, avatar_url, group_id)
       )`,
    )
    .eq("employee_profile.group_member.group_id", id)
    .order("paid_at", { ascending: false })
    .limit(100);

  const payments = ((rawPayments ?? []) as unknown as PaymentRow[]).map(
    (p) => {
      const ep = p.employee_profile;
      const member = Array.isArray(ep?.group_member)
        ? ep?.group_member?.[0]
        : ep?.group_member;
      return {
        ...p,
        currency: ep?.currency ?? "ARS",
        member: member ?? null,
      };
    },
  );

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: group.name, href: `/app/groups/${id}` },
          { label: "Pagos" },
        ]}
        title="Pagos"
        subtitle="Liquidaciones registradas en este grupo. Ordenadas por fecha de pago."
        icon={<Coins className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      {payments.length === 0 ? (
        <Card className="border-dashed">
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no registraste ningún pago. Entrá al perfil de un empleado
            y tocá "Liquidar pago".
          </p>
        </Card>
      ) : (
        <MotionList className="grid gap-2.5">
          {payments.map((p) => {
            const member = p.member;
            const memberName = member?.display_name ?? "Empleado";
            return (
              <MotionListItem key={p.id}>
                <Link
                  href={`/app/groups/${id}/payments/${p.id}`}
                  className="block"
                >
                  <Card className="group transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <Avatar
                        name={memberName}
                        src={member?.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {memberName}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatShortDate(new Date(p.period_start))}{" → "}
                          {formatShortDate(new Date(p.period_end))}
                          {" · pagado "}
                          {new Date(p.paid_at).toLocaleDateString("es-AR", {
                            timeZone: AR_TIME_ZONE,
                          })}
                        </p>
                      </div>
                      <span className="text-base font-semibold tabular-nums">
                        {formatCurrency(p.total_amount, p.currency)}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </Card>
                </Link>
              </MotionListItem>
            );
          })}
        </MotionList>
      )}
    </div>
  );
}
