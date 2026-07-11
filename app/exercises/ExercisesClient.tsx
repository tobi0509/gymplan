"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EQUIPMENT, EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import { saveExercise, deleteExercise, type ExercisePayload } from "./actions";

type Muscle = { id: string; name: string; group: string };
type ExRow = {
  id: string;
  name: string;
  equipment: string;
  category: string | null;
  muscles: { muscleId: string; percentage: number }[];
};

const EMPTY_DRAFT = (): ExercisePayload => ({
  name: "",
  equipment: "DUMBBELL",
  category: "",
  muscles: [],
});

export default function ExercisesClient({
  exercises,
  muscles,
}: {
  exercises: ExRow[];
  muscles: Muscle[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Equipment | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ExercisePayload | null>(null);

  const muscleName = useMemo(
    () => Object.fromEntries(muscles.map((m) => [m.id, m.name])),
    [muscles],
  );

  const filtered = exercises.filter(
    (e) =>
      (filter === "ALL" || e.equipment === filter) &&
      e.name.toLowerCase().includes(search.toLowerCase()),
  );

  function openNew() {
    setDraft(EMPTY_DRAFT());
  }
  function openEdit(e: ExRow) {
    setDraft({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      category: e.category || "",
      muscles: e.muscles.map((m) => ({ ...m })),
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveExercise(draft);
      if (res.ok) {
        setDraft(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Übung wirklich löschen?")) return;
    start(async () => {
      await deleteExercise(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`chip ${filter === "ALL" ? "pill-active" : ""}`}
        >
          Alle
        </button>
        {EQUIPMENT.map((eq) => (
          <button
            key={eq}
            onClick={() => setFilter(eq)}
            className={`chip ${filter === eq ? "pill-active" : ""}`}
          >
            {EQUIPMENT_LABEL[eq]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            className="input w-48"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" onClick={openNew}>
            + Neue Übung
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((e) => {
          const sum = e.muscles.reduce((a, m) => a + m.percentage, 0);
          return (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {EQUIPMENT_LABEL[e.equipment as Equipment] ?? e.equipment}
                    {e.category ? ` · ${e.category}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost px-2 py-1" onClick={() => openEdit(e)}>
                    ✎
                  </button>
                  <button
                    className="btn-ghost px-2 py-1 text-danger"
                    onClick={() => remove(e.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.muscles
                  .slice()
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((m) => (
                    <span key={m.muscleId} className="chip">
                      {muscleName[m.muscleId] ?? "?"} · {m.percentage}%
                    </span>
                  ))}
                {sum !== 100 && (
                  <span className="chip text-warn">Σ {sum}%</span>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card text-muted">Keine Übungen gefunden.</div>
        )}
      </div>

      {/* Editor-Modal */}
      {draft && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          muscles={muscles}
          onSave={save}
          onCancel={() => setDraft(null)}
          pending={pending}
        />
      )}
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  muscles,
  onSave,
  onCancel,
  pending,
}: {
  draft: ExercisePayload;
  setDraft: (d: ExercisePayload) => void;
  muscles: Muscle[];
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const pctFor = (id: string) =>
    draft.muscles.find((m) => m.muscleId === id)?.percentage ?? 0;

  function setPct(id: string, value: number) {
    const others = draft.muscles.filter((m) => m.muscleId !== id);
    const next =
      value > 0 ? [...others, { muscleId: id, percentage: value }] : others;
    setDraft({ ...draft, muscles: next });
  }

  const sum = draft.muscles.reduce((a, m) => a + m.percentage, 0);

  // Muskeln nach Gruppe sortiert
  const groups = muscles.reduce<Record<string, Muscle[]>>((acc, m) => {
    (acc[m.group] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="card my-8 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">
          {draft.id ? "Übung bearbeiten" : "Neue Übung"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="z.B. Bankdrücken (KH)"
            />
          </div>
          <div>
            <label className="label">Equipment</label>
            <select
              className="input"
              value={draft.equipment}
              onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
            >
              {EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {EQUIPMENT_LABEL[eq]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kategorie</label>
            <input
              className="input"
              value={draft.category ?? ""}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Push / Pull / Legs…"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Muskeln (%)</label>
            <span
              className={`text-xs font-semibold ${
                sum === 100 ? "text-accent" : "text-warn"
              }`}
            >
              Summe: {sum}%
            </span>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {Object.entries(groups).map(([group, ms]) => (
              <div key={group}>
                <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                  {group}
                </div>
                <div className="space-y-2">
                  {ms.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-36 text-sm">{m.name}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={pctFor(m.id)}
                        onChange={(e) => setPct(m.id, Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-sm tabular-nums">
                        {pctFor(m.id)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onCancel}>
            Abbrechen
          </button>
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={pending || !draft.name.trim()}
          >
            {pending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
