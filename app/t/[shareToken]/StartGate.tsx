"use client";

import { useRouter } from "next/navigation";

export default function StartGate({
  shareToken,
  disabled,
  clientName,
}: {
  shareToken: string;
  disabled: boolean;
  clientName: string;
}) {
  const router = useRouter();

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
        {disabled ? "Kein Training verfügbar" : "Training starten"}
      </button>
    </div>
  );
}
