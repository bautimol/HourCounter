import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Poné tu email y te mandamos un link para elegir una nueva.
        </p>
      </div>

      {/* Where /auth/reset sends someone whose link was dead. */}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <ForgotForm email={email} />

      <p className="text-sm text-muted-foreground">
        ¿Te acordaste?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
