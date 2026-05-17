"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Download } from "lucide-react";
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, Hint } from "@/components/ui/input";

type Status =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "no-key" }
  | { kind: "denied" }
  | { kind: "subscribed"; endpoint: string }
  | { kind: "unsubscribed" };

type InstallStatus =
  | { kind: "idle" }
  | { kind: "available"; prompt: BeforeInstallPromptEvent }
  | { kind: "installed" };

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * urlBase64 → Uint8Array conversion required by pushManager.subscribe.
 * VAPID keys are distributed as urlsafe-base64. Returns a Uint8Array
 * backed by an explicit ArrayBuffer so TS treats it as a valid
 * BufferSource for `applicationServerKey`.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSection({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [install, setInstall] = useState<InstallStatus>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Hide the whole card when there is genuinely nothing to show: no VAPID
  // configured (push won't work) AND no install prompt waiting. Showing a
  // "falta VAPID" message to end users is technical noise that suggests the
  // app is broken when it isn't.
  const hasPushSupport = vapidPublicKey !== null;

  // Inspect current subscription state on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus({
        kind: "unsupported",
        reason:
          typeof navigator !== "undefined" &&
          /iPhone|iPad|iPod/i.test(navigator.userAgent)
            ? "Las notificaciones push necesitan iOS 16.4+ y la app instalada en pantalla principal."
            : "Tu navegador no soporta push notifications.",
      });
      return;
    }
    if (!vapidPublicKey) {
      setStatus({ kind: "no-key" });
      return;
    }
    if (Notification.permission === "denied") {
      setStatus({ kind: "denied" });
      return;
    }

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setStatus({ kind: "subscribed", endpoint: sub.endpoint });
        } else {
          setStatus({ kind: "unsubscribed" });
        }
      } catch (e) {
        setError((e as Error).message);
        setStatus({ kind: "unsubscribed" });
      }
    })();
  }, [vapidPublicKey]);

  // Capture beforeinstallprompt for the "Instalar app" button.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstall({ kind: "available", prompt: e as BeforeInstallPromptEvent });
    };
    const onInstalled = () => setInstall({ kind: "installed" });

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function subscribe() {
    setError(null);
    if (!vapidPublicKey) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus({ kind: "denied" });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const formData = new FormData();
      formData.set("endpoint", json.endpoint ?? sub.endpoint);
      formData.set("p256dh", json.keys?.p256dh ?? "");
      formData.set("auth", json.keys?.auth ?? "");
      formData.set("user_agent", navigator.userAgent);

      startTransition(async () => {
        const res = await subscribeToPushAction(
          { error: null, ok: false },
          formData,
        );
        if (res.error) {
          setError(res.error);
          return;
        }
        setStatus({ kind: "subscribed", endpoint: sub.endpoint });
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function unsubscribe() {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? "";
      if (sub) await sub.unsubscribe();

      if (endpoint) {
        const formData = new FormData();
        formData.set("endpoint", endpoint);
        startTransition(async () => {
          await unsubscribeFromPushAction(
            { error: null, ok: false },
            formData,
          );
          setStatus({ kind: "unsubscribed" });
        });
      } else {
        setStatus({ kind: "unsubscribed" });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function installApp() {
    if (install.kind !== "available") return;
    await install.prompt.prompt();
    const result = await install.prompt.userChoice;
    if (result.outcome === "accepted") {
      setInstall({ kind: "installed" });
    }
  }

  // Skip the card entirely when neither feature is actionable.
  if (!hasPushSupport && install.kind !== "available") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
          Notificaciones e instalación
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 pt-0">
        {/* Install prompt */}
        {install.kind === "available" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">Instalar HourCounter</p>
              <p className="text-xs text-muted-foreground">
                La app aparece en tu pantalla principal y se abre en pantalla
                completa.
              </p>
            </div>
            <Button type="button" size="sm" onClick={installApp}>
              <Download className="h-4 w-4" aria-hidden />
              Instalar
            </Button>
          </div>
        )}

        {/* Push subscription */}
        <div className="space-y-2">
          {status.kind === "loading" && (
            <p className="text-sm text-muted-foreground">Cargando estado…</p>
          )}

          {status.kind === "unsupported" && (
            <p className="text-sm text-muted-foreground">{status.reason}</p>
          )}

          {/* "no-key" is intentionally not rendered — surfacing "(falta VAPID)"
              to end users reads like the app is broken. We hide the whole card
              early when there is nothing else to show; here we silently no-op. */}

          {status.kind === "denied" && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Tu navegador denegó las notificaciones. Activalas desde la
              configuración del sitio si querés recibir avisos.
            </p>
          )}

          {status.kind === "unsubscribed" && (
            <>
              <p className="text-sm text-muted-foreground">
                Recibí avisos cuando un empleado fiche, cuando haya turnos para
                verificar, o cuando te olvides de cerrar el tuyo.
              </p>
              <Button
                type="button"
                onClick={subscribe}
                disabled={pending || !vapidPublicKey}
              >
                <Bell className="h-4 w-4" aria-hidden />
                Activar notificaciones
              </Button>
            </>
          )}

          {status.kind === "subscribed" && (
            <>
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <Bell className="h-4 w-4" aria-hidden />
                Notificaciones activadas en este dispositivo.
              </p>
              <Hint>
                Si no las querés más, podés desactivarlas acá o desde la
                configuración del navegador.
              </Hint>
              <Button
                type="button"
                variant="secondary"
                onClick={unsubscribe}
                disabled={pending}
              >
                <BellOff className="h-4 w-4" aria-hidden />
                Desactivar en este dispositivo
              </Button>
            </>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      </CardBody>
    </Card>
  );
}
