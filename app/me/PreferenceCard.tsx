"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedule";
import { saveTrainingPreference } from "./actions";

// Karte "Dein Trainingsrhythmus": Wochentage mit Zeit + gewünschte Häufigkeit.
// Mit vorhandener Präferenz eingeklappt als Einzeiler mit "Bearbeiten".
export default function PreferenceCard({
  initialWeekdays,
  initialFrequency,
  collapsed,
  error,
}: {
  initialWeekdays: number[];
  initialFrequency: number | null;
  collapsed: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(!collapsed);
  const [days, setDays] = useState<number[]>(initialWeekdays);
  const [frequency, setFrequency] = useState(initialFrequency ?? 3);

  const summary =
    initialWeekdays.length > 0
      ? `${initialWeekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")} · ${initialFrequency}× pro Woche`
      : null;

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  if (!open) {
    return (
      <section className="card flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Dein Trainingsrhythmus</div>
          <div className="text-sm text-muted">{summary}</div>
        </div>
        <button className="btn-ghost" type="button" onClick={() => setOpen(true)}>
          Bearbeiten
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-4 border-accent/40">
      <div>
        <h2 className="text-lg font-semibold">Dein Trainingsrhythmus</h2>
        <p className="text-sm text-muted">
          An welchen Tagen hast du Zeit zu trainieren? Dein Trainer stellt dir
          daraus dein Wochenprogramm zusammen.
        </p>
      </div>
      <form action={saveTrainingPreference} className="space-y-4">
        <div>
          <div className="label">Ich habe Zeit am …</div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, d) => (
              <label
                key={d}
                className="flex cursor-pointer items-center rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
              >
                <input
                  type="checkbox"
                  name="weekday"
                  value={d}
                  checked={days.includes(d)}
                  onChange={() => toggleDay(d)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="label">So oft möchte ich pro Woche trainieren</div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <label
                key={n}
                className="flex cursor-pointer items-center rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
              >
                <input
                  type="radio"
                  name="frequency"
                  value={n}
                  checked={frequency === n}
                  onChange={() => setFrequency(n)}
                  className="sr-only"
                />
                {n}×
              </label>
            ))}
          </div>
        </div>
        {frequency > days.length && days.length > 0 && (
          <p className="text-sm text-muted">
            Tipp: Du möchtest {frequency}× trainieren, hast aber nur{" "}
            {days.length} {days.length === 1 ? "Tag" : "Tage"} ausgewählt.
          </p>
        )}
        {error === "days" && (
          <p className="text-sm text-danger">Bitte wähle mindestens einen Tag.</p>
        )}
        <div className="flex gap-2">
          {collapsed && (
            <button
              className="btn-ghost flex-1"
              type="button"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </button>
          )}
          <button className="btn-primary flex-1" type="submit">
            Speichern
          </button>
        </div>
      </form>
    </section>
  );
}
