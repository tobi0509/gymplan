"use client";

import { useState, useTransition } from "react";
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
import { useUndo } from "@/components/useUndo";
import {
  createQueueEntry,
  renameQueueEntry,
  deleteQueueEntry,
  reorderQueueEntries,
  copyPlanToClient,
} from "./actions";

export type QueueEntry = {
  id: string;
  name: string;
  exerciseCount: number;
  done: boolean;
};

export type ClientOption = { id: string; displayName: string };

export default function PlanQueueClient({
  accountId,
  initialItems,
  clients,
}: {
  accountId: string;
  initialItems: QueueEntry[];
  clients: ClientOption[];
}) {
  const [items, setItems] = useState<QueueEntry[]>(initialItems);
  const [notice, setNotice] = useState<string | null>(null);
  const [, start] = useTransition();
  const undo = useUndo();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Löschen mit Rückgängig. Trainings mit Verlauf werden serverseitig nur
  // archiviert — Verlauf & Fortschritt des Kunden bleiben erhalten.
  function remove(id: string) {
    const idx = items.findIndex((it) => it.id === id);
    const item = items[idx];
    if (!item) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    undo.schedule(
      `„${item.name}" gelöscht`,
      () => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("accountId", accountId);
        start(async () => {
          await deleteQueueEntry(fd);
        });
      },
      () =>
        setItems((prev) => {
          const next = prev.slice();
          next.splice(Math.min(idx, next.length), 0, item);
          return next;
        }),
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    undo.flush();
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    start(async () => {
      await reorderQueueEntries(accountId, next.map((it) => it.id));
    });
  }

  function copy(
    id: string,
    name: string,
    exerciseCount: number,
    targetAccountId: string,
    targetName: string,
  ) {
    start(async () => {
      const res = await copyPlanToClient(id, targetAccountId);
      if (targetAccountId === accountId) {
        setItems((prev) => [
          ...prev,
          { id: res.newPlanId, name, exerciseCount, done: false },
        ]);
      } else {
        setNotice(`An ${targetName} kopiert ✓`);
        setTimeout(() => setNotice(null), 2500);
      }
    });
  }

  function move(id: string, dir: "up" | "down") {
    const idx = items.findIndex((it) => it.id === id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= items.length) return;
    undo.flush();
    const next = items.slice();
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setItems(next);
    start(async () => {
      await reorderQueueEntries(accountId, next.map((it) => it.id));
    });
  }

  const nextUpId = items.find((it) => !it.done)?.id;

  return (
    <div className="space-y-3">
      {undo.toastNode}
      {notice && (
        <div className="card border-accent/40 text-sm text-accent">{notice}</div>
      )}

      {items.length === 0 && (
        <div className="card text-muted">
          Noch keine Trainings. Füge unten das erste Training hinzu.
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
            <QueueCard
              key={it.id}
              item={it}
              index={idx}
              accountId={accountId}
              clients={clients}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              isNextUp={it.id === nextUpId}
              onMove={move}
              onRemove={remove}
              onCopy={copy}
            />
          ))}
        </SortableContext>
      </DndContext>

      <form action={createQueueEntry} className="card flex gap-2">
        <input type="hidden" name="accountId" value={accountId} />
        <input
          name="name"
          className="input flex-1"
          placeholder="z.B. Woche 1 – Ganzkörper"
          required
        />
        <button className="btn-primary" type="submit">
          + Training hinzufügen
        </button>
      </form>
    </div>
  );
}

function QueueCard({
  item,
  index,
  accountId,
  clients,
  isFirst,
  isLast,
  isNextUp,
  onMove,
  onRemove,
  onCopy,
}: {
  item: QueueEntry;
  index: number;
  accountId: string;
  clients: ClientOption[];
  isFirst: boolean;
  isLast: boolean;
  isNextUp: boolean;
  onMove: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  onCopy: (
    id: string,
    name: string,
    exerciseCount: number,
    targetAccountId: string,
    targetName: string,
  ) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : item.done ? 0.65 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-1">
          <button
            className="-ml-2 -mt-2 grid h-11 w-11 shrink-0 cursor-grab place-items-center rounded-lg text-lg text-muted hover:bg-surface-2 active:cursor-grabbing"
            // touch-action: none — sonst scrollt der Browser am Handy, statt zu ziehen
            style={{ touchAction: "none" }}
            aria-label="Ziehen zum Umsortieren"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-xs text-muted">
                {index + 1}
              </span>
              {editing ? (
                <form
                  action={renameQueueEntry}
                  onSubmit={() => setEditing(false)}
                  className="flex items-center gap-1"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="accountId" value={accountId} />
                  <input
                    name="name"
                    defaultValue={item.name}
                    autoFocus
                    className="input"
                    onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                  />
                </form>
              ) : (
                <button
                  className="font-semibold hover:text-accent"
                  onClick={() => setEditing(true)}
                  title="Umbenennen"
                >
                  {item.name}
                </button>
              )}
              {item.done && <span className="chip text-accent">✓ erledigt</span>}
              {!item.done && isNextUp && (
                <span className="chip text-accent">Als Nächstes</span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted sm:pl-8">
              {item.exerciseCount} Übungen
            </div>
          </div>
        </div>
        {/* Handy: alle Aktionen gesammelt hinter ⋯ — sonst bleibt neben fünf
            Buttons kein Platz für den Namen */}
        <button
          className="btn-ghost shrink-0 px-3 text-lg sm:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label={`Aktionen für ${item.name}`}
          aria-haspopup="dialog"
        >
          ⋯
        </button>
        <div className="hidden items-center gap-0.5 sm:flex">
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
            className="btn-ghost px-2 py-1"
            onClick={() => setCopying((v) => !v)}
            aria-label={`${item.name} kopieren`}
            title="An einen Kunden kopieren (auch denselben, für nochmal eintragen)"
          >
            Kopieren
          </button>
          <Link href={`/plans/${item.id}`} className="btn-ghost px-2 py-1">
            Bearbeiten
          </Link>
          <button
            className="btn-ghost px-2 py-1 text-danger"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 !mt-0 flex items-end bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Aktionen für ${item.name}`}
        >
          <div
            className="w-full space-y-1 rounded-t-3xl border-t bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
            <div className="mb-2 truncate px-1 text-sm font-semibold text-muted">{item.name}</div>
            {(
              [
                { label: "✎ Übungen bearbeiten", href: `/plans/${item.id}` },
                { label: "Umbenennen", run: () => setEditing(true) },
                { label: "▲ Nach oben", run: () => onMove(item.id, "up"), disabled: isFirst },
                { label: "▼ Nach unten", run: () => onMove(item.id, "down"), disabled: isLast },
                { label: "Kopieren …", run: () => setCopying(true) },
                { label: "Löschen", run: () => onRemove(item.id), danger: true },
              ] as { label: string; href?: string; run?: () => void; disabled?: boolean; danger?: boolean }[]
            ).map((a) =>
              a.href ? (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex h-12 w-full items-center rounded-xl px-3 font-medium hover:bg-surface-2"
                >
                  {a.label}
                </Link>
              ) : (
                <button
                  key={a.label}
                  disabled={a.disabled}
                  onClick={() => {
                    setMenuOpen(false);
                    a.run?.();
                  }}
                  className={`flex h-12 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-surface-2 disabled:opacity-40 ${
                    a.danger ? "text-danger" : ""
                  }`}
                >
                  {a.label}
                </button>
              ),
            )}
            <button
              className="btn-ghost mt-2 w-full"
              onClick={() => setMenuOpen(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {copying && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 sm:pl-8">
          <select
            className="input flex-1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">An welchen Kunden?</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === accountId ? `${c.displayName} (nochmal eintragen)` : c.displayName}
              </option>
            ))}
          </select>
          <button
            className="btn-primary px-3 py-1.5 text-sm"
            disabled={!target}
            onClick={() => {
              const chosen = clients.find((c) => c.id === target);
              if (!chosen) return;
              onCopy(item.id, item.name, item.exerciseCount, chosen.id, chosen.displayName);
              setCopying(false);
              setTarget("");
            }}
          >
            Kopieren
          </button>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setCopying(false)}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}
