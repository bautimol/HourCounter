import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Marquee3D } from "@/components/landing/marquee-3d";
import { FeaturesGrid } from "@/components/landing/features-grid";

export default async function LandingPage() {
  // Logged-in users go straight to the app — they don't need the pitch.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Background layers (viewport-fixed, no hard cuts) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-30 dark:opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 20% -10%, var(--color-accent-soft) 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 80% 110%, #67e8f960 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 text-foreground/40"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.05,
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <LandingNavbar />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-32 sm:pt-40 lg:pt-48">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              En construcción · v0
            </span>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Trackeá horas.
              <br />
              Calculá pagos.
              <br />
              <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
                Sin más Excel.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
              Dashboard para empleadores que pagan por hora. Roles
              configurables, clock in / out con cronómetro, multi-empleador,
              y la cuenta lista al momento de pagar.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground shadow-lg shadow-emerald-600/30 ring-1 ring-inset ring-white/10 transition-opacity hover:opacity-95"
              >
                Crear cuenta
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-surface px-6 text-base font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>

          {/* 3D Marquee */}
          <div className="-mx-4 mt-20 sm:mt-24">
            <Marquee3D />
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Todo lo que un Excel no te puede dar.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Pensado para negocios chicos donde el dueño paga por hora y la
              cuenta del fin de mes la hace a mano.
            </p>
          </div>

          <div className="mt-12">
            <FeaturesGrid />
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-24 sm:pb-32">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-500/10 via-surface to-cyan-500/10 p-10 text-center shadow-xl shadow-emerald-900/5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
            />
            <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Empezá a trackear hoy.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-base text-muted-foreground">
              Creás tu grupo en 30 segundos, mandás un link a tu primer
              empleado y listo.
            </p>
            <div className="relative mt-6">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground shadow-lg shadow-emerald-600/30 ring-1 ring-inset ring-white/10 transition-opacity hover:opacity-95"
              >
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mx-auto max-w-6xl px-4 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} HourCounter</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
