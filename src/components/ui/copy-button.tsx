"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Copy-to-clipboard button with a tactile "Copiado" feedback that auto-resets
 * after 1.5s. Used for invitation links etc.
 */
export function CopyButton({
  value,
  label = "Copiar",
  successLabel = "Copiado",
  className,
  size = "sm",
}: {
  value: string;
  label?: string;
  successLabel?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — most modern browsers always allow clipboard.writeText on
      // user gesture; if it fails the user can copy manually.
    }
  }

  const sizeClass =
    size === "md" ? "h-9 px-3 text-sm" : "h-8 px-2.5 text-xs";

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium transition-colors",
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-surface text-foreground hover:bg-surface-muted",
        sizeClass,
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {successLabel}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
    </button>
  );
}
