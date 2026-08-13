import { cn } from "@/lib/cn";

/**
 * The mark's geometry, in one place. Shared by the in-app <Logo /> and by the
 * PWA icon routes, which render through satori and cannot import CSS — so the
 * shape lives here as plain path data rather than as a styled component.
 *
 * Drawn on a 48×48 canvas: a clock centred at (28,24) with r=14, deliberately
 * open on the left, and three speed lines running into that opening. The gap
 * is the point — a closed ring would read as a generic clock icon.
 */
const PATHS = [
  // Ring, open on the left.
  "M16.53 15.97 A14 14 0 1 1 16.53 32.03",
  // Hands: 12 and roughly 4:30, meeting at the centre.
  "M28 24 V15.5",
  "M28 24 L34.5 30.5",
  // Speed lines, staggered so the eye reads left-to-right movement.
  "M11.5 17.5 H17.5",
  "M5.5 24 H15",
  "M10.5 30.5 H16.5",
  // Trailing dot — the tail end of the fastest line.
  "M4.6 30.5 H4.7",
];

/**
 * Clockity mark for use inside the app.
 *
 * Vector rather than the exported PNG: sharp from a 16px favicon up, weighs
 * nothing, and takes `currentColor`, so it follows the theme instead of being
 * a fixed green that fights the light palette.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-8 w-8", className)}
      aria-hidden
      focusable="false"
    >
      {PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Same mark for the PWA icon routes. Takes explicit size and colour because
 * satori resolves neither CSS classes nor `currentColor`.
 */
export function LogoMark({
  size,
  color = "#ffffff",
}: {
  size: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
