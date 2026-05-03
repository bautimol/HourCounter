import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names with conditional logic and Tailwind merge,
 * so later classes override earlier ones (e.g. `cn("p-2", "p-4")` → `p-4`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
