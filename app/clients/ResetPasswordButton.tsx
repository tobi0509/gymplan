"use client";

import { useState } from "react";
import { resetClientPassword, type Credentials } from "./actions";
import CredentialsBox from "./CredentialsBox";

export default function ResetPasswordButton({
  accountId,
  loginUrl,
}: {
  accountId: string;
  loginUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);

  async function reset() {
    setBusy(true);
    const res = await resetClientPassword(accountId);
    setBusy(false);
    if (res.ok) setCreds(res);
  }

  return (
    <>
      <button className="btn-ghost" type="button" onClick={reset} disabled={busy}>
        {busy ? "…" : "Neues Passwort"}
      </button>
      {creds && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm">
            <CredentialsBox
              creds={creds}
              loginUrl={loginUrl}
              onClose={() => setCreds(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
