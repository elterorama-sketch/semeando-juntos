"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have; failing silently keeps the app
        // fully usable in browsers/contexts that block service workers.
      });
    }
  }, []);
  return null;
}
