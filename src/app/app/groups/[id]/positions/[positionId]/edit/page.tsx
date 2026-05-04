import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PositionForm,
  type PositionFormInitial,
} from "../../position-form";
import { updatePositionAction } from "./actions";

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{ id: string; positionId: string }>;
}) {
  const { id, positionId } = await params;
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

  const { data: position } = await supabase
    .from("positions")
    .select(
      "id, name, hourly_rate, payment_period, custom_period_days, currency",
    )
    .eq("id", positionId)
    .eq("group_id", id)
    .maybeSingle();

  if (!position) notFound();

  const { data: fixedAmounts } = await supabase
    .from("position_fixed_amounts")
    .select("description, amount, frequency, custom_days")
    .eq("position_id", positionId)
    .order("created_at", { ascending: true });

  const initial: PositionFormInitial = {
    name: position.name,
    hourlyRate: String(position.hourly_rate),
    paymentPeriod: position.payment_period,
    customPeriodDays:
      position.custom_period_days != null
        ? String(position.custom_period_days)
        : "",
    currency: position.currency,
    fixedAmounts: (fixedAmounts ?? []).map((fa) => ({
      description: fa.description,
      amount: String(fa.amount),
      frequency: fa.frequency,
      customDays: fa.custom_days != null ? String(fa.custom_days) : "",
    })),
  };

  const action = updatePositionAction.bind(null, id, positionId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/app/groups/${id}/positions/${positionId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {position.name}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Editar rol</CardTitle>
        </CardHeader>
        <CardBody>
          <PositionForm
            action={action}
            initial={initial}
            submitLabel="Guardar cambios"
          />
        </CardBody>
      </Card>
    </div>
  );
}
