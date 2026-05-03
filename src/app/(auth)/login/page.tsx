import Link from "next/link";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const signupHref = next
    ? `/signup?next=${encodeURIComponent(next)}`
    : "/signup";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Accedé a tu cuenta para administrar tus grupos
          </CardDescription>
        </CardHeader>
        <CardBody>
          {error && (
            <p className="mb-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <LoginForm next={next} />
        </CardBody>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link
          href={signupHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Registrate
        </Link>
      </p>
    </div>
  );
}
