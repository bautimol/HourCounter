import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CreateGroupForm } from "./create-group-form";

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-md space-y-8">
      <PageHeader
        crumbs={[
          { label: "Tus grupos", href: "/app" },
          { label: "Nuevo grupo" },
        ]}
        title="Crear un grupo"
        subtitle="Vas a quedar como empleador. Después podés invitar empleados y otros empleadores."
        icon={<Plus className="h-5 w-5" aria-hidden />}
        accent="emerald"
      />

      <Card>
        <CardBody>
          <CreateGroupForm />
        </CardBody>
      </Card>
    </div>
  );
}
