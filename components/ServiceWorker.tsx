"use client";

import { useEffect } from "react";

// Registriert den Offline-Service-Worker (nur im Production-Build — im
// Dev-Server würde er HMR/Chunk-Updates verdecken).
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional — App funktioniert auch ohne */
    });
  }, []);
  return null;
}

// Offline gespeicherte Seiten gehören zum eingeloggten Account — beim
// Logout/Login verwerfen (geteilte Geräte).
export function clearPageCache() {
  if (typeof caches === "undefined") return;
  caches.delete("gymplan-pages").catch(() => {});
}
