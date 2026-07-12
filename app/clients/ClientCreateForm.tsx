"use client";

import { useState } from "react";
import { createClientAccount, type Credentials } from "./actions";
import CredentialsBox from "./CredentialsBox";

export default function ClientCreateForm({ loginUrl }: { loginUrl: string }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createClientAccount(displayName, username);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Unbekannter Fehler");
      return;
    }
    setCreds(res);
    setDisplayName("");
    setUsername("");
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Neuer Kunde</h2>
      {creds ? (
        <CredentialsBox
          creds={creds}
          loginUrl={loginUrl}
          onClose={() => setCreds(null)}
        />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label" htmlFor="displayName">
              Name
            </label>
            <input
              id="displayName"
              className="input"
              placeholder="z.B. Max Mustermann"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="username">
              Benutzername
            </label>
            <input
              id="username"
              className="input"
              placeholder="z.B. max"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Erstellt…" : "Zugang erstellen"}
          </button>
          <p className="text-xs text-muted">
            Das Passwort wird automatisch erzeugt und nach dem Erstellen einmalig
            angezeigt.
          </p>
        </form>
      )}
    </div>
  );
}
