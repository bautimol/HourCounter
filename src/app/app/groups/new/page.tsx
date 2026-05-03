import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateGroupForm } from "./create-group-form";

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Volver
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Crear un grupo</CardTitle>
          <CardDescription>
            Vas a quedar como empleador. Después podés invitar empleados y
            otros empleadores.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <CreateGroupForm />
        </CardBody>
      </Card>
    </div>
  );
}
