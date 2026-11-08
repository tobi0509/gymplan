"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Muss zu SessionFlowClient passen (saveKey / RESTORE_MAX_AGE_MS)
const saveKey = (planId: string) => `gymplan.session.${planId}`;
const RESTORE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Plan = { id: string; name: string; shareToken: string };

// Zeigt ein laufendes (lokal gesichertes) Training an, damit man nach
// App-Wechsel/Reload nicht erst den Plan suchen muss.
export default function ResumeBanner({
  plans,
  clientName,
}: {
  plans: Plan[];
  clientName: string;
}) {
  const [running, setRunning] = useState<{ plan: Plan; exIdx: number } | null>(null);

  useEffect(() => {
    let best: { plan: Plan; exIdx: number; savedAt: number } | null = null;
    for (const plan of plans) {
      try {
        const raw = localStorage.getItem(saveKey(plan.id));
        if (!raw) continue;
        const s = JSON.parse(raw) as {
          sessionId?: string;
          phase?: string;
          exIdx?: number;
          clientName?: string;
          savedAt?: number;
        };
        if (!s.sessionId || s.phase === "done" || s.phase === "motivation") continue;
        if (s.clientName != null && s.clientName !== clientName) continue;
        const savedAt = s.savedAt ?? 0;
        if (Date.now() - savedAt > RESTORE_MAX_AGE_MS) continue;
        if (!best || savedAt > best.savedAt) best = { plan, exIdx: s.exIdx ?? 0, savedAt };
      } catch {
        /* ignore */
      }
    }
    if (best) setRunning({ plan: best.plan, exIdx: best.exIdx });
  }, [plans, clientName]);

  if (!running) return null;
  return (
    <Link
      href={`/t/${running.plan.shareToken}/session`}
      className="card mb-6 flex items-center gap-3 border-accent bg-accent-soft animate-pop-in"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-lg text-black">
        ▶
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Training fortsetzen</span>
        <span className="block truncate text-sm text-muted">
          {running.plan.name} · Übung {running.exIdx + 1}
        </span>
      </span>
      <span className="text-accent">→</span>
    </Link>
  );
}
