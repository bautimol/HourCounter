import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock3, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-foreground">
              <Clock3 className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              HourCounter
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app/me"
              className="hidden items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-muted sm:flex"
              title="Tu perfil"
            >
              <Avatar name={fullName} size="sm" />
              <span className="text-sm text-foreground">{fullName}</span>
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-muted"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
