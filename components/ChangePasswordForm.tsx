"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changeOwnPassword } from "@/app/clients/actions";

export default function ChangePasswordForm() {
  const [state, formAction] = useFormState(changeOwnPassword, {});

  return (
    <form action={formAction} className="card space-y-3">
      <h2 className="text-lg font-semibold">Passwort ändern</h2>
      <div>
        <label className="label" htmlFor="current">
          Aktuelles Passwort
        </label>
        <input
          id="current"
          name="current"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="next">
          Neues Passwort (min. 8 Zeichen)
        </label>
        <input
          id="next"
          name="next"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-accent">Passwort wurde geändert ✓</p>
      )}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-ghost w-full" type="submit" disabled={pending}>
      {pending ? "Speichert…" : "Passwort ändern"}
    </button>
  );
}
