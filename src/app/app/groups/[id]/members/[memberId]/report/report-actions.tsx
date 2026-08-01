"use client";

import { useState } from "react";
import { Check, Copy, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Print / share / copy for the per-day report. The plain-text version is
 * built on the server and passed in, so the numbers can never drift from
 * the table above.
 */
export function ReportActions({ shareText }: { shareText: string }) {
  const [copied, setCopied] = useState(false);

  function printNow() {
    if (typeof window !== "undefined") window.print();
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // User dismissed the sheet, or the browser refused — fall through to
        // WhatsApp so the button always does something.
      }
    }
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions): leave the button
      // alone rather than pretending it worked.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={printNow} size="sm">
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir / PDF
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={share}>
        <Share2 className="h-4 w-4" aria-hidden />
        Compartir
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copiado" : "Copiar texto"}
      </Button>
    </div>
  );
}
