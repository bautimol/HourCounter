import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

/**
 * Second half of the recovery flow. Reached only from `/auth/reset`, which
 * turns the emailed link into a session before sending anyone here.
 *
 * Public in the proxy on purpose: guarding it would bounce a dead link to
 * /login, where the person is stuck for exactly the reason they came. Landing
 * here without a session is a normal outcome — an expired link, a second
 * click on an already-used one — and it deserves an explanation and a way
 * out, not a redirect. Nothing leaks either way, since the password change
 * itself needs the session.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">
            Ese link ya no sirve
          </h1>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-surface-muted/40 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Los links de recuperación se usan una sola vez y vencen a la hora.
            Pedí uno nuevo y usalo apenas te llegue.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Pedir un link nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Elegí tu contraseña nueva
        </h1>
        <p className="text-sm text-muted-foreground">
          La vas a usar para entrar con {user.email}.
        </p>
      </div>

      <ResetForm />
    </div>
  );
}
