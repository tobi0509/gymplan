"use client";

import Link from "next/link";
import LineChart from "@/components/LineChart";
import type { HistorySession } from "../actions";

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

export default function HistoryClient({
  shareToken,
  clientName,
  sessions,
}: {
  shareToken: string;
  clientName: string;
  sessions: HistorySession[];
}) {
  const name = clientName;

  if (sessions.length === 0) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-muted">
          Noch keine abgeschlossenen Trainings, {name}. Leg los – danach siehst du
          hier deinen Fortschritt.
        </p>
        <Link href={`/t/${shareToken}`} className="btn-primary">
          Training starten
        </Link>
      </div>
    );
  }

  // Kennzahlen
  const count = sessions.length;
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0;
  };
  const avgMot = avg(sessions.map((s) => s.motivation));
  const avgExe = avg(sessions.map((s) => s.exertion));
  const totalVol = sessions.reduce((a, s) => a + s.totalVolume, 0);

  const labels = sessions.map((s) => shortDate(s.date));

  return (
    <div className="space-y-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Trainings" value={String(count)} />
        <Stat label="Ø Motivation" value={`${avgMot}`} suffix="/20" />
        <Stat label="Ø Anstrengung" value={`${avgExe}`} suffix="/20" />
        <Stat label="Volumen ges." value={totalVol.toLocaleString("de-DE")} suffix=" kg" />
      </div>

      {/* Volumen-Chart */}
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">Trainingsvolumen</h2>
        <p className="mb-3 text-xs text-muted">Summe Gewicht × Wdh. pro Einheit (kg)</p>
        <LineChart
          labels={labels}
          series={[
            {
              name: "Volumen",
              color: "var(--accent)",
              values: sessions.map((s) => s.totalVolume),
            },
          ]}
        />
      </div>

      {/* Motivation vs Anstrengung */}
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">Motivation & Anstrengung</h2>
        <p className="mb-3 text-xs text-muted">Skala 1–20</p>
        <LineChart
          labels={labels}
          series={[
            {
              name: "Motivation",
              color: "var(--accent)",
              values: sessions.map((s) => s.motivation),
            },
            {
              name: "Anstrengung",
              color: "var(--warn)",
              values: sessions.map((s) => s.exertion),
            },
          ]}
        />
      </div>

      {/* Einzel-Sessions (neueste zuerst) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Einheiten</h2>
        {sessions
          .slice()
          .reverse()
          .map((s) => (
            <div key={s.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{longDate(s.date)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.motivation != null && (
                    <span className="chip">Motivation {s.motivation}</span>
                  )}
                  {s.exertion != null && (
                    <span className="chip">Anstrengung {s.exertion}</span>
                  )}
                  {s.durationMin != null && (
                    <span className="chip">{s.durationMin} min</span>
                  )}
                  <span className="chip text-accent">{s.totalVolume} kg</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {s.exercises.map((e, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{e.name}</span>
                      {e.topWeight != null && (
                        <span className="text-xs text-muted">
                          Top {e.topWeight} kg
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {e.sets.map((st) => (
                        <span
                          key={st.setNumber}
                          className="rounded-md bg-surface px-2 py-0.5 text-xs tabular-nums text-muted"
                        >
                          {st.weight ?? "–"}kg × {st.reps ?? "–"}
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

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="card-2">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">
        {value}
        {suffix && <span className="text-sm font-medium text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
