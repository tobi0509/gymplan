"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { computeCoverage, type PlanExerciseInput } from "@/lib/coverage";
import { EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import {
  addExerciseToPlan,
  updatePlanExercise,
  removePlanExercise,
  type PlanExerciseDTO,
} from "./actions";

type Muscle = { id: string; name: string; svgKey: string; group: string };
type ExOption = {
  id: string;
  name: string;
  equipment: string;
  contributions: { muscleId: string; percentage: number }[];
};

export default function PlanBuilderClient({
  plan,
  initialItems,
  allExercises,
  muscles,
}: {
  plan: { id: string; name: string; shareToken: string };
  initialItems: PlanExerciseDTO[];
  allExercises: ExOption[];
  muscles: Muscle[];
}) {
  const [items, setItems] = useState<PlanExerciseDTO[]>(initialItems);
  const [picker, setPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  const coverage = useMemo(() => {
    const input: PlanExerciseInput[] = items.map((it) => ({
      exerciseName: it.name,
      sets: it.sets,
      contributions: it.contributions,
    }));
    return computeCoverage(input);
  }, [items]);

  const bodyData = useMemo(
    () => toBodyData(muscles, coverage),
    [muscles, coverage],
  );

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${plan.shareToken}`
      : `/t/${plan.shareToken}`;

  function add(exerciseId: string) {
    start(async () => {
      const dto = await addExerciseToPlan(plan.id, exerciseId);
      setItems((prev) => [...prev, dto]);
    });
    setPicker(false);
  }

  function patch(id: string, fields: Partial<PlanExerciseDTO>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...fields } : it)),
    );
  }

  function persist(id: string, fields: Parameters<typeof updatePlanExercise>[1]) {
    start(async () => {
      await updatePlanExercise(id, fields);
    });
  }

  // Sätze/Wdh. sind Int-Spalten: Dezimal-, 0- und Negativ-Eingaben beim
  // Verlassen des Felds normalisieren (UI und DB bleiben synchron).
  function commitSets(id: string, v: number | "") {
    const n = v === "" ? 1 : Math.max(1, Math.round(v));
    patch(id, { sets: n });
    persist(id, { sets: n });
  }
  function commitReps(id: string, v: number | "") {
    const n = v === "" ? null : Math.max(1, Math.round(v));
    patch(id, { targetReps: n });
    persist(id, { targetReps: n });
  }
  function commitWeight(id: string, v: number | "") {
    const n = v === "" ? null : Math.max(0, v);
    patch(id, { targetWeight: n });
    persist(id, { targetWeight: n });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    start(async () => {
      await removePlanExercise(id);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  // Muskeln nach coverage sortiert für die Legende
  const legend = muscles
    .map((m) => ({ ...m, pct: coverage[m.id]?.coveragePct ?? 0 }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Alle Pläne
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{plan.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={copyLink}>
            {copied ? "✓ Kopiert" : "Share-Link kopieren"}
          </button>
          <Link href={`/t/${plan.shareToken}`} className="btn-primary" target="_blank">
            Kunden-Ansicht
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Übungen */}
        <section className="space-y-3">
          {items.length === 0 && (
            <div className="card text-muted">
              Noch keine Übungen. Füge unten deine erste Übung hinzu.
            </div>
          )}

          {items.map((it, idx) => (
            <div key={it.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-xs text-muted">
                      {idx + 1}
                    </span>
                    <span className="font-semibold">{it.name}</span>
                  </div>
                  <div className="mt-0.5 pl-8 text-xs text-muted">
                    {EQUIPMENT_LABEL[it.equipment as Equipment] ?? it.equipment}
                  </div>
                </div>
                <button
                  className="btn-ghost px-2 py-1 text-danger"
                  onClick={() => remove(it.id)}
                >
                  ✕
                </button>
              </div>

              {(it.category ?? "").toLowerCase() === "cardio" ? (
                <div className="mt-3 grid grid-cols-2 gap-3 pl-8">
                  <NumberField
                    label="Sätze"
                    value={it.sets}
                    min={1}
                    onChange={(v) => patch(it.id, { sets: v === "" ? 0 : v })}
                    onCommit={(v) => commitSets(it.id, v)}
                  />
                  <NumberField
                    label="Ziel-Minuten"
                    value={it.targetReps ?? ""}
                    onChange={(v) => patch(it.id, { targetReps: v === "" ? null : v })}
                    onCommit={(v) => commitReps(it.id, v)}
                  />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-3 pl-8">
                  <NumberField
                    label="Sätze"
                    value={it.sets}
                    min={1}
                    onChange={(v) => patch(it.id, { sets: v === "" ? 0 : v })}
                    onCommit={(v) => commitSets(it.id, v)}
                  />
                  <NumberField
                    label="Wdh."
                    value={it.targetReps ?? ""}
                    onChange={(v) => patch(it.id, { targetReps: v === "" ? null : v })}
                    onCommit={(v) => commitReps(it.id, v)}
                  />
                  <NumberField
                    label="Gewicht (kg)"
                    value={it.targetWeight ?? ""}
                    step={0.5}
                    onChange={(v) => patch(it.id, { targetWeight: v === "" ? null : v })}
                    onCommit={(v) => commitWeight(it.id, v)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add exercise */}
          {picker ? (
            <ExercisePicker
              options={allExercises}
              onPick={add}
              onClose={() => setPicker(false)}
            />
          ) : (
            <button
              className="btn-ghost w-full border-dashed"
              onClick={() => setPicker(true)}
            >
              + Übung hinzufügen
            </button>
          )}
        </section>

        {/* Muskel-Abdeckung */}
        <aside className="space-y-4">
          <div className="card lg:sticky lg:top-20">
            <h2 className="mb-1 text-lg font-semibold">Muskel-Abdeckung</h2>
            <p className="mb-3 text-xs text-muted">
              100 % = 2× pro Woche voll trainiert.
            </p>
            <BodyMap data={bodyData} />

            <div className="mt-4 space-y-1.5">
              {legend.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs">{m.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${Math.round(m.pct)}%`,
                        opacity: m.pct >= 100 ? 1 : 0.55 + (m.pct / 100) * 0.45,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted">
                    {Math.round(m.pct)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min,
  step,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  onCommit: (v: number | "") => void;
  min?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        min={min}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        onBlur={(e) =>
          onCommit(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    </div>
  );
}

function ExercisePicker({
  options,
  onPick,
  onClose,
}: {
  options: ExOption[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="input"
          placeholder="Übung suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-ghost" onClick={onClose}>
          Schließen
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-surface-2"
          >
            <span>{o.name}</span>
            <span className="text-xs text-muted">
              {EQUIPMENT_LABEL[o.equipment as Equipment] ?? o.equipment}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted">Nichts gefunden.</div>
        )}
      </div>
    </div>
  );
}
