import Link from "next/link";
import { AuthHero } from "./auth-hero";
import { Logo } from "@/components/logo";

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
            <Logo className="h-7 w-7 text-accent" />
            <span className="text-sm font-semibold tracking-tight">
              Clockity
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
