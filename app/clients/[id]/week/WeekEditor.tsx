"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedule";
import { computeCoverage, type PlanExerciseInput } from "@/lib/coverage";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { saveStandardWeek, saveWeekOverride, clearWeekOverride } from "./actions";

export type PlanOption = { id: string; name: string };
export type MuscleOption = { id: string; name: string; svgKey: string };

// Editor für eine Woche: 7 Zeilen Mo–So mit je einem Plan-Select, plus eine
// live mitlaufende Muskel-Abdeckung über die aktuell ausgewählten Pläne.
// mode "standard" = Standardwoche; sonst konkrete Woche (weekStart als ISO).
export default function WeekEditor({
  accountId,
  mode,
  woche,
  dayDates,
  introText,
  initialPlanByDay,
  plans,
  planExercisesById,
  muscles,
  availableWeekdays,
  frequency,
  overrideExists,
  saved,
}: {
  accountId: string;
  mode: "standard" | "week";
  woche?: string;
  dayDates?: string[]; // "Mo 14.07." je Wochentag (nur Wochen-Tabs)
  introText: string;
  initialPlanByDay: (string | null)[]; // Index 0–6 → planId
  plans: PlanOption[];
  planExercisesById: Record<string, PlanExerciseInput[]>;
  muscles: MuscleOption[];
  availableWeekdays: number[];
  frequency: number | null;
  overrideExists?: boolean;
  saved?: boolean;
}) {
  const [planByDay, setPlanByDay] = useState<(string | null)[]>(initialPlanByDay);
  const count = planByDay.filter(Boolean).length;
  const hasPreference = availableWeekdays.length > 0 || frequency != null;

  // Muskel-Abdeckung über alle in dieser Woche ausgewählten Pläne hinweg.
  const combinedExercises = useMemo(
    () =>
      planByDay
        .filter((id): id is string => id != null)
        .flatMap((id) => planExercisesById[id] ?? []),
    [planByDay, planExercisesById],
  );
  const coverage = useMemo(() => computeCoverage(combinedExercises), [combinedExercises]);
  const bodyData = useMemo(() => toBodyData(muscles, coverage), [muscles, coverage]);
  const legend = muscles
    .map((m) => ({
      ...m,
      pct: coverage[m.id]?.coveragePct ?? 0,
      rawPct: coverage[m.id]?.rawPct ?? 0,
    }))
    .sort((a, b) => b.rawPct - a.rawPct);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="card space-y-4">
        {mode === "week" && overrideExists && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
            <span>Diese Woche weicht von der Standardwoche ab.</span>
            <form action={clearWeekOverride}>
              <input type="hidden" name="accountId" value={accountId} />
              <input type="hidden" name="woche" value={woche} />
              <button className="btn-ghost text-sm" type="submit">
                Auf Standardwoche zurücksetzen
              </button>
            </form>
          </div>
        )}

        <p className="text-sm text-muted">{introText}</p>

        <form
          action={mode === "standard" ? saveStandardWeek : saveWeekOverride}
          className="space-y-4"
        >
          <input type="hidden" name="accountId" value={accountId} />
          {mode === "week" && (
            <input type="hidden" name="woche" value={woche} />
          )}

          <div className="space-y-2">
            {WEEKDAY_LABELS.map((label, d) => {
              const available = availableWeekdays.includes(d);
              const filled = planByDay[d] != null && planByDay[d] !== "";
              const stale = hasPreference && !available && filled;
              return (
                <div
                  key={d}
                  className={`grid grid-cols-[5.5rem_1fr] items-center gap-2 rounded-xl px-2 py-1 ${
                    hasPreference && !available ? "opacity-55" : ""
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold tabular-nums">
                      {mode === "week" && dayDates ? dayDates[d] : label}
                    </div>
                    <div className="text-[11px] leading-tight text-muted">
                      {hasPreference
                        ? available
                          ? "hat Zeit"
                          : "laut Kunde keine Zeit"
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      name={`day-${d}`}
                      className="input"
                      value={planByDay[d] ?? ""}
                      onChange={(e) =>
                        setPlanByDay((prev) => {
                          const next = [...prev];
                          next[d] = e.target.value || null;
                          return next;
                        })
                      }
                    >
                      <option value="">– Frei –</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {stale && (
                      <span
                        className="chip shrink-0 text-danger"
                        title="Der Kunde hat an diesem Tag laut Verfügbarkeit keine Zeit"
                      >
                        ⚠︎
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {frequency != null && (
            <p className={`text-sm ${count === frequency ? "text-accent" : "text-muted"}`}>
              {count} von {frequency} gewünschten Einheiten verteilt
              {count > frequency ? " – mehr als gewünscht" : ""}
            </p>
          )}

          {saved && <p className="text-sm text-accent">Gespeichert ✓</p>}

          <button className="btn-primary w-full" type="submit">
            {mode === "standard" ? "Standardwoche speichern" : "Nur diese Woche speichern"}
          </button>
          {mode === "week" && (
            <p className="text-xs text-muted">
              Alle Tage auf „Frei“ = trainingsfreie Woche. Die Standardwoche
              bleibt unverändert.
            </p>
          )}
        </form>
      </div>

      <aside className="card space-y-3 lg:sticky lg:top-20">
        <div>
          <h2 className="text-lg font-semibold">Muskel-Abdeckung</h2>
          <p className="text-xs text-muted">
            100 % = 2× pro Woche voll trainiert. Werte über 100 % zeigen eine
            Überlastung durch die gewählten Pläne dieser Woche.
          </p>
        </div>
        <BodyMap data={bodyData} />
        <div className="space-y-1.5">
          {legend.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs">{m.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    m.rawPct > 100 ? "bg-danger" : "bg-accent"
                  }`}
                  style={{
                    width: `${Math.round(Math.min(100, m.rawPct))}%`,
                    opacity: m.rawPct >= 100 ? 1 : 0.55 + (m.rawPct / 100) * 0.45,
                  }}
                />
              </div>
              <span
                className={`w-11 shrink-0 text-right text-xs tabular-nums ${
                  m.rawPct > 100 ? "font-semibold text-danger" : "text-muted"
                }`}
              >
                {Math.round(m.rawPct)}%
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
