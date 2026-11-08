"use client";

import { useState } from "react";
import ClientCreateForm from "./ClientCreateForm";

// Handy: "+ Kunde" oben statt Formular unter der ganzen Kundenliste.
export default function ClientCreateSheet({ loginUrl }: { loginUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary w-full md:hidden" onClick={() => setOpen(true)}>
        + Neuer Kunde
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 !mt-0 flex items-start justify-center bg-black/60 px-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm md:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Kein Schließen per Hintergrund-Tap: sonst wären frisch erzeugte
              Zugangsdaten versehentlich weg */}
          <div className="w-full max-w-md space-y-2 animate-pop-in">
            <ClientCreateForm loginUrl={loginUrl} onDone={() => setOpen(false)} />
            <button className="btn-ghost w-full" onClick={() => setOpen(false)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
