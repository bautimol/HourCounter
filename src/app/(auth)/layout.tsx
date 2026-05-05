import Link from "next/link";
import { Clock3 } from "lucide-react";
import { AuthHero } from "./auth-hero";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: form column */}
      <div className="flex w-full flex-col px-6 py-10 sm:px-10 lg:w-1/2">
        {/* Logo only on mobile (the hero shows it on desktop). */}
        <div className="mb-10 lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground shadow-sm shadow-emerald-700/30">
              <Clock3 className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              HourCounter
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Right: hero (desktop only) */}
      <AuthHero />
    </div>
  );
}
