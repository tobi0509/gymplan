"use client";

import { useState } from "react";
import type { Credentials } from "./actions";

// Zeigt frisch erzeugte Zugangsdaten einmalig an, mit Copy-Button für eine
// versandfertige Nachricht (z.B. für WhatsApp/E-Mail).
export default function CredentialsBox({
  creds,
  loginUrl,
  onClose,
}: {
  creds: Credentials;
  loginUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const message = [
    `Hi ${creds.displayName}! Hier ist dein Zugang zu GymPlan:`,
    ``,
    `Login: ${loginUrl}`,
    `Benutzername: ${creds.username}`,
    `Passwort: ${creds.password}`,
    ``,
    `Nach dem Anmelden siehst du deine Trainingspläne und deinen Fortschritt.`,
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-surface-2 p-3">
      <p className="text-sm font-semibold text-accent">
        Zugangsdaten – jetzt kopieren und versenden!
      </p>
      <p className="text-xs text-muted">
        Das Passwort wird aus Sicherheitsgründen nicht noch einmal angezeigt.
      </p>
      <div className="space-y-1 rounded-lg bg-surface px-3 py-2 text-sm">
        <div>
          Benutzername: <span className="font-mono">{creds.username}</span>
        </div>
        <div>
          Passwort: <span className="font-mono">{creds.password}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" type="button" onClick={copy}>
          {copied ? "Kopiert ✓" : "Nachricht kopieren"}
        </button>
        <button className="btn-ghost" type="button" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}
