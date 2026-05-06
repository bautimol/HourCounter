import { cn } from "@/lib/cn";

/**
 * Renders a user's avatar. If `src` is provided we show the image with a
 * subtle ring; otherwise we fall back to the initials of `name` over a
 * deterministic color (so the same person always gets the same color).
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const safe = (name ?? "?").trim() || "?";
  const sizeClass =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : size === "lg"
        ? "h-12 w-12 text-base"
        : size === "xl"
          ? "h-20 w-20 text-2xl"
          : "h-9 w-9 text-sm";

  if (src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-full bg-surface-muted ring-1 ring-border",
          sizeClass,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Foto de ${safe}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  const initials = getInitials(safe);
  const palette = pickPalette(safe);

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none",
        palette,
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const palettes = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
];

function pickPalette(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palettes[h % palettes.length]!;
}
