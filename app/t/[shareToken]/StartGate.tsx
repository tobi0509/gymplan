"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const NAME_KEY = "gymplan.clientName";

export default function StartGate({
  shareToken,
  disabled,
}: {
  shareToken: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) || "");
    setLoaded(true);
  }, []);

  function start() {
    const n = name.trim();
    if (!n) return;
    localStorage.setItem(NAME_KEY, n);
    router.push(`/t/${shareToken}/session`);
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="label" htmlFor="clientName">
          Dein Name
        </label>
        <input
          id="clientName"
          className="input"
          placeholder="Wie heißt du?"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button
        className="btn-primary w-full py-3.5 text-base"
        onClick={start}
        disabled={!loaded || disabled || !name.trim()}
      >
        {disabled ? "Kein Training verfügbar" : "Training starten"}
      </button>
    </div>
  );
}
