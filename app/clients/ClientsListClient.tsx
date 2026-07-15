"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteClientAccount } from "./actions";
import ResetPasswordButton from "./ResetPasswordButton";
import { WEEKDAY_LABELS } from "@/lib/schedule";
import type { Tone } from "@/lib/clientStatus";

export type ClientRow = {
  id: string;
  displayName: string;
  username: string;
  totalSessions: number;
  activityLabel: string;
  activityTone: Tone;
  activityDays: number | null;
  frequency: null | { label: string; tone: Tone };
  weekdays: number[]; // 0–6
  planNames: string[];
  programNames: string[];
  weekWarning: null | { label: string; tone: Tone };
  severity: 0 | 1 | 2;
};

type SortMode = "attention" | "name" | "recent";

const sortLabel: Record<SortMode, string> = {
  attention: "Aufmerksamkeit zuerst",
  name: "Name A–Z",
  recent: "Zuletzt trainiert",
};

export default function ClientsListClient({
  clients,
  loginUrl,
}: {
  clients: ClientRow[];
  loginUrl: string;
}) {
  const [sort, setSort] = useState<SortMode>("attention");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const filtered = onlyFlagged ? clients.filter((c) => c.severity >= 1) : clients;
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.displayName.localeCompare(b.displayName, "de");
    if (sort === "recent") return (a.activityDays ?? Infinity) - (b.activityDays ?? Infinity);
    // attention: severity absteigend, dann am längsten inaktiv zuerst, dann Name
    if (b.severity !== a.severity) return b.severity - a.severity;
    if ((b.activityDays ?? Infinity) !== (a.activityDays ?? Infinity)) {
      return (b.activityDays ?? Infinity) - (a.activityDays ?? Infinity);
    }
    return a.displayName.localeCompare(b.displayName, "de");
  });

  return (
    <section className="space-y-3">
      {clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(sortLabel) as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSort(mode)}
              className={`chip ${sort === mode ? "pill-active" : ""}`}
            >
              {sortLabel[mode]}
            </button>
          ))}
          <span className="mx-1 text-muted">·</span>
          <button
            type="button"
            onClick={() => setOnlyFlagged((v) => !v)}
            className={`chip ${onlyFlagged ? "pill-active" : ""}`}
          >
            Nur auffällige
          </button>
        </div>
      )}

      {clients.length === 0 && (
        <div className="card text-muted">
          Noch keine Kunden. Lege rechts den ersten Zugang an.
        </div>
      )}
      {clients.length > 0 && sorted.length === 0 && (
        <div className="card text-muted">Keine Kunden für diesen Filter.</div>
      )}

      {sorted.map((c) => (
        <div key={c.id} className="card space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                href={`/clients/${c.id}`}
                className="text-lg font-semibold hover:text-accent"
              >
                {c.displayName}
              </Link>
              <div className="text-xs text-muted">
                Benutzername: <span className="font-mono">{c.username}</span>
                {" · "}
                {c.totalSessions} Trainings
              </div>
              <div className={`mt-0.5 text-xs font-medium ${c.activityTone}`}>
                {c.activityLabel}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ResetPasswordButton accountId={c.id} loginUrl={loginUrl} />
              <form action={deleteClientAccount}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  className="btn-ghost text-danger"
                  type="submit"
                  aria-label={`Zugang von ${c.displayName} löschen`}
                >
                  ✕
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {c.programNames.map((name) => (
              <span key={name} className="chip text-accent">
                📋 {name}
              </span>
            ))}
            {c.planNames.map((name) => (
              <span key={name} className="chip">
                {name}
              </span>
            ))}
            {c.planNames.length === 0 && c.programNames.length === 0 && (
              <span className="text-xs text-muted">
                Noch kein Plan oder Programm zugewiesen.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {WEEKDAY_LABELS.map((label, d) => (
                  <span
                    key={d}
                    className={`grid h-6 w-7 place-items-center rounded-md text-[11px] font-semibold ${
                      c.weekdays.includes(d)
                        ? "bg-accent-soft text-accent"
                        : "bg-surface text-muted opacity-50"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {c.frequency && (
                <span className={`chip ${c.frequency.tone}`}>{c.frequency.label}</span>
              )}
              {c.weekWarning && (
                <span className={`chip ${c.weekWarning.tone}`}>{c.weekWarning.label}</span>
              )}
            </div>
            <Link href={`/clients/${c.id}/week`} className="btn-ghost shrink-0">
              Wochenplan
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
