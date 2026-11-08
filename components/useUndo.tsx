"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const UNDO_MS = 5000;

type Pending = {
  id: number;
  commit: () => void;
  revert: () => void;
  timer: ReturnType<typeof setTimeout>;
};

// Löschen mit "Rückgängig": Die UI entfernt sofort (optimistisch), die
// eigentliche Server-Aktion läuft erst nach 5 s. Tippt man "Rückgängig",
// wird nur lokal zurückgesetzt — es ist nie etwas gelöscht worden.
// Verlässt man die Seite vorher, wird sofort ausgeführt.
export function useUndo() {
  const [toast, setToast] = useState<{ id: number; label: string } | null>(null);
  const pending = useRef<Pending | null>(null);

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    p.commit();
  }, []);

  const schedule = useCallback(
    (label: string, commit: () => void, revert: () => void) => {
      flush(); // vorherige Löschung jetzt endgültig ausführen
      const id = Date.now() + Math.random();
      const timer = setTimeout(() => {
        if (pending.current?.id !== id) return;
        pending.current = null;
        commit();
        setToast((t) => (t?.id === id ? null : t));
      }, UNDO_MS);
      pending.current = { id, commit, revert, timer };
      setToast({ id, label });
    },
    [flush],
  );

  const undo = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    p.revert();
    setToast(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush(); // Unmount (Navigation) → ausstehende Löschung ausführen
    };
  }, [flush]);

  const toastNode = toast ? (
    <div
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 !mt-0 mx-auto max-w-md px-4 md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div
        key={toast.id}
        className="flex items-center gap-3 overflow-hidden rounded-2xl border bg-surface-2 py-2 pl-4 pr-2 shadow-card animate-pop-in"
      >
        <span className="min-w-0 flex-1 truncate text-sm">{toast.label}</span>
        <button type="button" className="btn-ghost shrink-0 text-accent" onClick={undo}>
          Rückgängig
        </button>
      </div>
    </div>
  ) : null;

  return { schedule, flush, toastNode };
}
