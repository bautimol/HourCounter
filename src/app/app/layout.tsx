import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNavbar } from "@/components/navbar";

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
    <div className="relative min-h-screen bg-background">
      {/* Decorative grid background — very subtle, only at the top of pages. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(circle_at_top,_var(--color-accent-soft)_0%,_transparent_60%)] opacity-30"
      />

      <AppNavbar
        fullName={fullName}
        links={[{ label: "Mis grupos", href: "/app" }]}
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 pt-24 pb-12 sm:pt-28">
        {children}
      </main>
    </div>
  );
}
