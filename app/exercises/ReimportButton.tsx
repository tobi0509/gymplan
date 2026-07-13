"use client";

import { useState } from "react";
import { reimportExternalImages } from "./actions";

// Zeigt sich nur, wenn es noch extern verlinkte Bilder gibt, und holt sie
// per Klick auf den Server.
export default function ReimportButton({ count }: { count: number }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (count === 0 && !result) return null;

  async function run() {
    setBusy(true);
    const res = await reimportExternalImages();
    setBusy(false);
    let msg = `${res.imported} von ${res.total} Bildern übernommen.`;
    if (res.failedNames.length) {
      msg += ` Nicht geladen: ${res.failedNames.join(", ")} – dort bitte die Bildadresse prüfen oder die Datei direkt hochladen.`;
    }
    setResult(msg);
  }

  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {result ??
          `${count} Übungsbild${count === 1 ? " ist" : "er sind"} noch extern verlinkt und werden evtl. nicht angezeigt.`}
      </p>
      {!result && (
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? "Lädt…" : "Bilder auf den Server holen"}
        </button>
      )}
    </div>
  );
}
