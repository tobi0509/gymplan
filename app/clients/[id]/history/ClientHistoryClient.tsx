"use client";

import { useState, useTransition } from "react";
import LineChart from "@/components/LineChart";
import type { ClientHistorySession, ExerciseOption, ExerciseProgressPoint } from "@/lib/clientStatus";
import { fetchExerciseProgress } from "./actions";

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
function longDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ClientHistoryClient({
  accountId,
  sessions,
  exerciseOptions,
}: {
  accountId: string;
  sessions: ClientHistorySession[];
  exerciseOptions: ExerciseOption[];
}) {
  const [exerciseId, setExerciseId] = useState("");
  const [progress, setProgress] = useState<ExerciseProgressPoint[] | null>(null);
  const [isPending, start] = useTransition();

  function pickExercise(id: string) {
    setExerciseId(id);
    if (!id) {
      setProgress(null);
      return;
    }
    start(async () => {
      const points = await fetchExerciseProgress(accountId, id);
      setProgress(points);
    });
  }

  return (
    <div className="space-y-6">
      {/* Fortschritt je Übung */}
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Fortschritt je Übung</h2>
        <select
          className="input"
          value={exerciseId}
          onChange={(e) => pickExercise(e.target.value)}
        >
          <option value="">Übung auswählen…</option>
          {exerciseOptions.map((o) => (
            <option key={o.exerciseId} value={o.exerciseId}>
              {o.name}
            </option>
          ))}
        </select>

        {exerciseId && isPending && (
          <p className="text-sm text-muted">Lädt…</p>
        )}
        {exerciseId && !isPending && progress != null && (
          progress.length > 0 ? (
            <LineChart
              labels={progress.map((p) => shortDate(p.date))}
              series={[
                {
                  name: "Top-Gewicht (kg)",
                  color: "var(--accent)",
                  values: progress.map((p) => p.topWeight),
                },
              ]}
              ySuffix=" kg"
            />
          ) : (
            <p className="text-sm text-muted">Noch keine Sätze für diese Übung protokolliert.</p>
          )
        )}
      </div>

      {/* Letzte Trainings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Letzte Trainings</h2>
        {sessions.length === 0 && (
          <div className="card text-muted">Noch keine abgeschlossenen Trainings.</div>
        )}
        {sessions
          .slice()
          .reverse()
          .map((s) => (
            <div key={s.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{longDate(s.date)}</div>
                  <div className="text-xs text-muted">{s.planName}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.motivation != null && <span className="chip">Motivation {s.motivation}</span>}
                  {s.exertion != null && <span className="chip">Anstrengung {s.exertion}</span>}
                  {s.durationMin != null && <span className="chip">{s.durationMin} min</span>}
                  <span className="chip text-accent">{s.totalVolume} kg</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {s.exercises.map((e, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{e.name}</span>
                      {e.topWeight != null && (
                        <span className="text-xs text-muted">Top {e.topWeight} kg</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {e.sets.map((st) => (
                        <span
                          key={st.setNumber}
                          className="rounded-md bg-surface px-2 py-0.5 text-xs tabular-nums text-muted"
                        >
                          {st.durationMin != null
                            ? `${st.durationMin} min`
                            : `${st.weight ?? "–"}kg × ${st.reps ?? "–"}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {s.exercises.length === 0 && (
                  <p className="text-xs text-muted">Keine Sätze protokolliert.</p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
