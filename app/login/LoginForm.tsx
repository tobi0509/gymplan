"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { clearPageCache } from "@/components/ServiceWorker";

export default function LoginForm() {
  const [state, formAction] = useFormState<LoginState, FormData>(login, {});
  // Login-Seite = ausgeloggt: offline gespeicherte Seiten des vorherigen
  // Accounts verwerfen
  useEffect(() => clearPageCache(), []);

  return (
    <form action={formAction} className="card space-y-3">
      <div>
        <label className="label" htmlFor="username">
          Benutzername
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full py-3" type="submit" disabled={pending}>
      {pending ? "Anmelden…" : "Anmelden"}
    </button>
  );
}
