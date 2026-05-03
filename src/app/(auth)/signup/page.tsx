import Link from "next/link";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>
            Después vas a poder crear o unirte a un grupo
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SignupForm next={next} />
        </CardBody>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={loginHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
