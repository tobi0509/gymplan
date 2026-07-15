"use client";

import { useState } from "react";

export type AccordionExercise = {
  id: string; // planExercise.id
  name: string;
  equipmentLabel: string;
  category: string | null;
  imageUrl: string | null;
  sets: number;
  targetReps: number | null;
  targetWeight: number | null;
  muscles: { name: string; percentage: number }[]; // absteigend sortiert
};

// Reine Lese-Vorschau: aufklappbare Übungsdetails, keine Eingaben, keine
// Timer, keine Session-Nebenwirkungen.
export default function ExerciseAccordion({
  items,
}: {
  items: AccordionExercise[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {items.map((ex, i) => {
        const open = openId === ex.id;
        const isCardio = (ex.category ?? "").toLowerCase() === "cardio";
        return (
          <div key={ex.id} className="overflow-hidden rounded-xl bg-surface-2">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : ex.id)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface text-xs text-muted">
                  {i + 1}
                </span>
                {ex.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.imageUrl}
                    alt={ex.name}
                    className="h-10 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div>
                  <div className="text-sm font-medium">{ex.name}</div>
                  <div className="text-xs text-muted">{ex.equipmentLabel}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-right text-xs text-muted">
                  {isCardio ? (
                    <>
                      {ex.sets > 1 ? `${ex.sets} × ` : ""}
                      {ex.targetReps ?? "–"} min
                    </>
                  ) : (
                    <>
                      {ex.sets} × {ex.targetReps ?? "–"}
                      {ex.targetWeight ? ` · ${ex.targetWeight} kg` : ""}
                    </>
                  )}
                </span>
                <span
                  className={`text-xs text-muted transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </div>
            </button>

            {open && (
              <div className="space-y-3 border-t border-border px-3 py-3">
                {ex.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.imageUrl}
                    alt={`So geht ${ex.name}`}
                    className="max-h-64 w-full rounded-xl border bg-white object-contain"
                  />
                )}
                {ex.muscles.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs uppercase tracking-wide text-muted">
                      Trainierte Muskeln
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.muscles.map((m) => (
                        <span key={m.name} className="chip">
                          {m.name} {m.percentage} %
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="chip">{ex.equipmentLabel}</span>
                  {ex.category && <span className="chip">{ex.category}</span>}
                  <span className="chip text-accent">
                    {isCardio ? (
                      <>
                        Ziel: {ex.sets > 1 ? `${ex.sets} × ` : ""}
                        {ex.targetReps ?? "–"} min
                      </>
                    ) : (
                      <>
                        Ziel: {ex.sets} Sätze
                        {ex.targetReps ? ` × ${ex.targetReps} Wdh.` : ""}
                        {ex.targetWeight ? ` · ${ex.targetWeight} kg` : ""}
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
