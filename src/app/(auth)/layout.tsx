import Link from "next/link";
import { Clock3 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-foreground"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Clock3 className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            HourCounter
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
