"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedule";
import { saveStandardWeek, saveWeekOverride, clearWeekOverride } from "./actions";

export type PlanOption = { id: string; name: string };

// Editor für eine Woche: 7 Zeilen Mo–So mit je einem Plan-Select.
// mode "standard" = Standardwoche; sonst konkrete Woche (weekStart als ISO).
export default function WeekEditor({
  accountId,
  mode,
  weekStartIso,
  woche,
  dayDates,
  initialPlanByDay,
  plans,
  availableWeekdays,
  frequency,
  overrideExists,
  saved,
}: {
  accountId: string;
  mode: "standard" | "week";
  weekStartIso?: string;
  woche?: string;
  dayDates?: string[]; // "Mo 14.07." je Wochentag (nur Wochen-Tabs)
  initialPlanByDay: (string | null)[]; // Index 0–6 → planId
  plans: PlanOption[];
  availableWeekdays: number[];
  frequency: number | null;
  overrideExists?: boolean;
  saved?: boolean;
}) {
  const [planByDay, setPlanByDay] = useState<(string | null)[]>(initialPlanByDay);
  const count = planByDay.filter(Boolean).length;
  const hasPreference = availableWeekdays.length > 0 || frequency != null;

  return (
    <div className="space-y-4">
      {mode === "week" && overrideExists && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
          <span>Diese Woche weicht von der Standardwoche ab.</span>
          <form action={clearWeekOverride}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="weekStart" value={weekStartIso} />
            <input type="hidden" name="woche" value={woche} />
            <button className="btn-ghost text-sm" type="submit">
              Auf Standardwoche zurücksetzen
            </button>
          </form>
        </div>
      )}

      <form
        action={mode === "standard" ? saveStandardWeek : saveWeekOverride}
        className="space-y-4"
      >
        <input type="hidden" name="accountId" value={accountId} />
        {mode === "week" && (
          <>
            <input type="hidden" name="weekStart" value={weekStartIso} />
            <input type="hidden" name="woche" value={woche} />
          </>
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
                    <span className="chip shrink-0 text-danger" title="Der Kunde hat an diesem Tag laut Verfügbarkeit keine Zeit">
                      ⚠︎
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {frequency != null && (
          <p
            className={`text-sm ${
              count === frequency ? "text-accent" : "text-muted"
            }`}
          >
            {count} von {frequency} gewünschten Einheiten verteilt
            {count > frequency ? " – mehr als gewünscht" : ""}
          </p>
        )}

        {saved && (
          <p className="text-sm text-accent">Gespeichert ✓</p>
        )}

        <button className="btn-primary w-full" type="submit">
          {mode === "standard"
            ? "Standardwoche speichern"
            : "Nur diese Woche speichern"}
        </button>
        {mode === "week" && (
          <p className="text-xs text-muted">
            Alle Tage auf „Frei“ = trainingsfreie Woche. Die Standardwoche
            bleibt unverändert.
          </p>
        )}
      </form>
    </div>
  );
}
