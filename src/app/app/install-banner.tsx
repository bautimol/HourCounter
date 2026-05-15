"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hc-install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Discreet installable-PWA banner shown at the top of /app. Captures
 * `beforeinstallprompt`, gates by:
 *
 *   - already running in standalone (installed) → never show
 *   - dismissed in the last 7 days → don't show
 *
 * Tap "Instalar" → fires the native browser prompt.
 * Tap the X → snooze for 7 days.
 *
 * iOS Safari does not fire beforeinstallprompt; instead show a small
 * "Compartir → Añadir a pantalla principal" hint when we detect iOS.
 */
export function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [snoozed, setSnoozed] = useState(true); // start snoozed until we check
  const [isIos, setIsIos] = useState(false);
  const [dismissedIos, setDismissedIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as installed PWA?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari uses its own non-standard property:
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // Snooze check
    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
    const stillSnoozed = Date.now() - dismissedAt < DISMISS_TTL_MS;
    setSnoozed(stillSnoozed);

    // iOS detection (Safari doesn't fire beforeinstallprompt; we hint manually).
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    setIsIos(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setSnoozed(true);
    setDismissedIos(true);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const result = await event.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    } else {
      // User cancelled — also snooze so we don't pester them again immediately
      dismiss();
    }
  }

  if (installed) return null;
  if (snoozed) return null;

  // iOS: show a manual hint (no programmatic install on Safari)
  if (isIos && !dismissedIos) {
    return (
      <Banner
        icon={<Smartphone className="h-4 w-4" aria-hidden />}
        text={
          <>
            Para instalar la app en tu iPhone, tocá{" "}
            <span className="font-medium">Compartir</span> y luego{" "}
            <span className="font-medium">Añadir a pantalla de inicio</span>.
          </>
        }
        onDismiss={dismiss}
      />
    );
  }

  // Android / desktop Chrome / Edge: real install prompt available
  if (event) {
    return (
      <Banner
        icon={<Download className="h-4 w-4" aria-hidden />}
        text="Instalá HourCounter para que aparezca en tu pantalla principal."
        action={{ label: "Instalar", onClick: install }}
        onDismiss={dismiss}
      />
    );
  }

  return null;
}

function Banner({
  icon,
  text,
  action,
  onDismiss,
}: {
  icon: React.ReactNode;
  text: React.ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-3 shadow-sm shadow-emerald-700/10 backdrop-blur-sm dark:from-emerald-500/15 dark:via-emerald-500/5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </span>

      <p className="min-w-0 flex-1 text-sm text-foreground">{text}</p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm shadow-emerald-700/25 ring-1 ring-inset ring-white/15 transition-opacity hover:opacity-90"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {action.label}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Descartar"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
