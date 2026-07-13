"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StartGate({
  shareToken,
  planId,
  disabled,
  clientName,
}: {
  shareToken: string;
  planId: string;
  disabled: boolean;
  clientName: string;
}) {
  const router = useRouter();
  // Läuft noch ein angefangenes Training für diesen Plan? (siehe SessionFlowClient)
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`gymplan.session.${planId}`);
      if (raw) {
        const s = JSON.parse(raw);
        setHasSaved(Boolean(s?.sessionId) && s?.phase !== "done");
      }
    } catch {
      /* ignore */
    }
  }, [planId]);

  return (
    <div className="card space-y-3">
      <p className="text-center text-sm text-muted">
        Angemeldet als <span className="font-semibold text-foreground">{clientName}</span>
      </p>
      <button
        className="btn-primary w-full py-3.5 text-base"
        onClick={() => router.push(`/t/${shareToken}/session`)}
        disabled={disabled}
      >
        {disabled
          ? "Kein Training verfügbar"
          : hasSaved
            ? "▶ Training fortsetzen"
            : "Training starten"}
      </button>
      {hasSaved && (
        <p className="text-center text-xs text-muted">
          Du hast ein angefangenes Training – dein Zwischenstand ist gesichert.
        </p>
      )}
    </div>
  );
}
