"use client";

// Fallback bei Server-/Netzwerkfehlern. Pull-to-Refresh ist per CSS aus und
// die installierte App hat keinen Reload-Knopf — daher hier explizit anbieten.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="card w-full space-y-4 text-center">
        <div className="text-4xl">📶</div>
        <h1 className="text-lg font-semibold">Das hat nicht geklappt</h1>
        <p className="text-sm text-muted">
          Vermutlich ist die Verbindung gerade schwach. Deine Eingaben im
          laufenden Training bleiben gespeichert.
        </p>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => reset()}>
            Nochmal versuchen
          </button>
          <button className="btn-primary flex-1" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>
      </div>
    </main>
  );
}
