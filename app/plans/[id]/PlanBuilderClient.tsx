"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { computeCoverage, type PlanExerciseInput } from "@/lib/coverage";
import { EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import {
  addExerciseToPlan,
  updatePlanExercise,
  removePlanExercise,
  movePlanExercise,
  reorderPlanExercises,
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
  backHref,
  backLabel,
  initialItems,
  allExercises,
  muscles,
}: {
  plan: { id: string; name: string; shareToken: string };
  backHref: string;
  backLabel: string;
  initialItems: PlanExerciseDTO[];
  allExercises: ExOption[];
  muscles: Muscle[];
}) {
  const [items, setItems] = useState<PlanExerciseDTO[]>(initialItems);
  const [picker, setPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function move(id: string, dir: "up" | "down") {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
    start(async () => {
      await movePlanExercise(id, dir);
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.id === active.id);
      const newIndex = prev.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      start(async () => {
        await reorderPlanExercises(plan.id, next.map((it) => it.id));
      });
      return next;
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
          <Link href={backHref} className="text-sm text-muted hover:text-foreground">
            ← {backLabel}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{plan.name}</h1>
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((it) => it.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((it, idx) => (
                <ExerciseCard
                  key={it.id}
                  item={it}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  onMove={move}
                  onRemove={remove}
                  onPatch={patch}
                  onCommitSets={commitSets}
                  onCommitReps={commitReps}
                  onCommitWeight={commitWeight}
                />
              ))}
            </SortableContext>
          </DndContext>

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

function ExerciseCard({
  item,
  index,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onPatch,
  onCommitSets,
  onCommitReps,
  onCommitWeight,
}: {
  item: PlanExerciseDTO;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, fields: Partial<PlanExerciseDTO>) => void;
  onCommitSets: (id: string, v: number | "") => void;
  onCommitReps: (id: string, v: number | "") => void;
  onCommitWeight: (id: string, v: number | "") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1">
          <button
            className="mt-0.5 grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded-lg text-muted hover:bg-surface-2 active:cursor-grabbing"
            aria-label="Ziehen zum Umsortieren"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-xs text-muted">
                {index + 1}
              </span>
              <span className="font-semibold">{item.name}</span>
            </div>
            <div className="mt-0.5 pl-8 text-xs text-muted">
              {EQUIPMENT_LABEL[item.equipment as Equipment] ?? item.equipment}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => onMove(item.id, "up")}
            disabled={isFirst}
            aria-label={`${item.name} nach oben`}
          >
            ▲
          </button>
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => onMove(item.id, "down")}
            disabled={isLast}
            aria-label={`${item.name} nach unten`}
          >
            ▼
          </button>
          <button
            className="btn-ghost px-2 py-1 text-danger"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
        </div>
      </div>

      {(item.category ?? "").toLowerCase() === "cardio" ? (
        <div className="mt-3 grid grid-cols-2 gap-3 pl-8">
          <NumberField
            label="Sätze"
            value={item.sets}
            min={1}
            onChange={(v) => onPatch(item.id, { sets: v === "" ? 0 : v })}
            onCommit={(v) => onCommitSets(item.id, v)}
          />
          <NumberField
            label="Ziel-Minuten"
            value={item.targetReps ?? ""}
            onChange={(v) => onPatch(item.id, { targetReps: v === "" ? null : v })}
            onCommit={(v) => onCommitReps(item.id, v)}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3 pl-8">
          <NumberField
            label="Sätze"
            value={item.sets}
            min={1}
            onChange={(v) => onPatch(item.id, { sets: v === "" ? 0 : v })}
            onCommit={(v) => onCommitSets(item.id, v)}
          />
          <NumberField
            label="Wdh."
            value={item.targetReps ?? ""}
            onChange={(v) => onPatch(item.id, { targetReps: v === "" ? null : v })}
            onCommit={(v) => onCommitReps(item.id, v)}
          />
          <NumberField
            label="Gewicht (kg)"
            value={item.targetWeight ?? ""}
            step={0.5}
            onChange={(v) => onPatch(item.id, { targetWeight: v === "" ? null : v })}
            onCommit={(v) => onCommitWeight(item.id, v)}
          />
        </div>
      )}
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
