"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deletePlan } from "./actions";
import { useUndo } from "@/components/useUndo";

type PlanItem = {
  id: string;
  name: string;
  ownerName: string;
  exerciseCount: number;
  sessionCount: number;
  assignedToId: string | null;
  assignedToName: string | null;
};

type ClientOption = { id: string; displayName: string };

export default function PlansListClient({
  plans,
  clients,
}: {
  plans: PlanItem[];
  clients: ClientOption[];
}) {
  // "ALL" = alle Pläne, "NONE" = ohne Kunde, sonst Account-ID des Kunden
  const [filter, setFilter] = useState<string>("ALL");
  // Optimistisch ausgeblendete Pläne (Löschen mit Rückgängig)
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const undo = useUndo();

  function remove(p: PlanItem) {
    setHidden((h) => new Set(h).add(p.id));
    undo.schedule(
      `„${p.name}" gelöscht`,
      () => {
        const fd = new FormData();
        fd.set("id", p.id);
        start(async () => {
          await deletePlan(fd);
        });
      },
      () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(p.id);
          return next;
        }),
    );
  }

  const filtered = plans.filter((p) => !hidden.has(p.id)).filter((p) =>
    filter === "ALL"
      ? true
      : filter === "NONE"
        ? p.assignedToId == null
        : p.assignedToId === filter,
  );

  return (
    <section className="space-y-3">
      {undo.toastNode}
      {clients.length > 0 && plans.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`chip ${filter === "ALL" ? "pill-active" : ""}`}
          >
            Alle
          </button>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`chip ${filter === c.id ? "pill-active" : ""}`}
            >
              {c.displayName}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter("NONE")}
            className={`chip ${filter === "NONE" ? "pill-active" : ""}`}
          >
            Ohne Kunde
          </button>
        </div>
      )}

      {plans.length === 0 && (
        <div className="card text-muted">
          Noch keine Pläne. Trainings legst du beim jeweiligen Kunden unter „Trainings bearbeiten“ an.
        </div>
      )}
      {plans.length > 0 && filtered.length === 0 && (
        <div className="card text-muted">Keine Pläne für diesen Filter.</div>
      )}
      {filtered.map((p) => (
        <div key={p.id} className="card flex items-center justify-between">
          <div>
            <Link
              href={`/plans/${p.id}`}
              className="text-lg font-semibold hover:text-accent"
            >
              {p.name}
            </Link>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
              <span className="chip">{p.exerciseCount} Übungen</span>
              <span className="chip">{p.sessionCount} Sessions</span>
              <span className="chip">von {p.ownerName}</span>
              {p.assignedToName && (
                <span className="chip text-accent">→ {p.assignedToName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/plans/${p.id}`} className="btn-ghost">
              Öffnen
            </Link>
            <button
              type="button"
              className="btn-ghost text-danger"
              aria-label={`Plan ${p.name} löschen`}
              onClick={() => remove(p)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
