"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount. Silent on failure (we don't
 * want to scare the user with errors) but logs to console for debugging.
 *
 * The SW lives at /public/sw.js (vanilla JS, no Next.js bundling).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Defer until idle so it doesn't compete with first paint.
    const idle = (cb: () => void) => {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void) => void;
      };
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(cb);
      } else {
        setTimeout(cb, 200);
      }
    };

    idle(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("Service worker registration failed:", err);
        });
    });
  }, []);

  return null;
}
