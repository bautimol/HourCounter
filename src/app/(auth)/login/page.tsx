import Link from "next/link";
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
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Iniciar sesión
        </h1>
        <p className="text-sm text-muted-foreground">
          Accedé a tu cuenta para administrar tus grupos.
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <LoginForm next={next} />

      <p className="text-sm text-muted-foreground">
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
