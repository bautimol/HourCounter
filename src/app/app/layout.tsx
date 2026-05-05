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
      {/* Soft accent glow that follows the viewport (no hard cuts). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-25 dark:opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, var(--color-accent-soft) 0%, transparent 65%)",
        }}
      />
      {/* Subtle grid pattern, also viewport-fixed, very low contrast. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 text-foreground/40"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.04,
          maskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 80%)",
        }}
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
