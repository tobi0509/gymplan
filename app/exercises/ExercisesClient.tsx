"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EQUIPMENT, EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import {
  saveExercise,
  deleteExercise,
  importImage,
  type ExercisePayload,
} from "./actions";

type Muscle = { id: string; name: string; group: string };
type ExRow = {
  id: string;
  name: string;
  equipment: string;
  category: string | null;
  imageUrl: string | null;
  muscles: { muscleId: string; percentage: number }[];
};

const EMPTY_DRAFT = (): ExercisePayload => ({
  name: "",
  equipment: "DUMBBELL",
  category: "",
  imageUrl: null,
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

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
    setSaveError(null);
    setDraft(EMPTY_DRAFT());
  }
  function openEdit(e: ExRow) {
    setSaveError(null);
    setDraft({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      category: e.category || "",
      imageUrl: e.imageUrl,
      muscles: e.muscles.map((m) => ({ ...m })),
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveExercise(draft);
      if (res.ok) {
        setDraft(null);
        setSaveError(null);
        router.refresh();
      } else {
        // z.B. doppelter Name — Eingaben bleiben erhalten
        setSaveError(res.error ?? "Speichern fehlgeschlagen.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Übung wirklich löschen?")) return;
    setListError(null);
    start(async () => {
      const res = await deleteExercise(id);
      if (!res.ok) {
        // Übung steckt noch in Plänen — Hinweis statt Fehlerseite
        setListError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: Suche volle Breite, Filter-Chips am Handy als
          horizontal scrollbare Zeile statt 3–4 umbrechender Reihen */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="input flex-1 md:max-w-xs"
            type="search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" onClick={openNew}>
            + Neu
          </button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          <button
            onClick={() => setFilter("ALL")}
            className={`chip shrink-0 px-3 py-2 ${filter === "ALL" ? "pill-active" : ""}`}
          >
            Alle
          </button>
          {EQUIPMENT.map((eq) => (
            <button
              key={eq}
              onClick={() => setFilter(eq)}
              className={`chip shrink-0 px-3 py-2 ${filter === eq ? "pill-active" : ""}`}
            >
              {EQUIPMENT_LABEL[eq]}
            </button>
          ))}
        </div>
      </div>

      {listError && (
        <div className="card border-danger text-sm text-danger">{listError}</div>
      )}

      {/* Liste */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((e) => {
          const sum = e.muscles.reduce((a, m) => a + m.percentage, 0);
          return (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.imageUrl}
                      alt={e.name}
                      className="h-12 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 text-lg">
                      🏋️
                    </div>
                  )}
                  <div>
                    <div className="font-semibold">{e.name}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {EQUIPMENT_LABEL[e.equipment as Equipment] ?? e.equipment}
                      {e.category ? ` · ${e.category}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost px-3"
                    onClick={() => openEdit(e)}
                    aria-label={`${e.name} bearbeiten`}
                  >
                    ✎
                  </button>
                  <button
                    className="btn-ghost px-3 text-danger"
                    onClick={() => remove(e.id)}
                    aria-label={`${e.name} löschen`}
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
          saveError={saveError}
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
  saveError,
}: {
  draft: ExercisePayload;
  setDraft: (d: ExercisePayload) => void;
  muscles: Muscle[];
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  saveError: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [urlValue, setUrlValue] = useState(draft.imageUrl ?? "");
  // Ausgangsstand merken: Schließen mit ungespeicherten Änderungen fragt nach
  // (am Handy tippt man beim Scrollen leicht auf den Hintergrund)
  const [initial] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== initial;
  function requestClose() {
    if (dirty && !confirm("Ungespeicherte Änderungen verwerfen?")) return;
    onCancel();
  }

  async function onImportUrl() {
    const url = urlValue.trim();
    if (!url) return;
    setUploadError(null);
    setImporting(true);
    try {
      const res = await importImage(url);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setDraft({ ...draft, imageUrl: res.url });
      setUrlValue(res.url);
    } finally {
      setImporting(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneuten Upload derselben Datei
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen");
      setDraft({ ...draft, imageUrl: data.url });
      setUrlValue(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

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
      className="fixed inset-0 z-50 !mt-0 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 px-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm md:pt-8"
      onClick={requestClose}
    >
      <div
        className="card w-full max-w-lg space-y-4 pb-0"
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

        {/* Beispielbild */}
        <div>
          <label className="label">Beispielbild (zeigt dem Kunden die Ausführung)</label>
          <div className="flex items-center gap-3">
            {draft.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.imageUrl}
                alt="Vorschau"
                className="h-20 w-28 shrink-0 rounded-xl border object-cover"
              />
            ) : (
              <div className="grid h-20 w-28 shrink-0 place-items-center rounded-xl border bg-surface-2 text-2xl">
                🏋️
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <label className="btn-ghost cursor-pointer">
                  {uploading ? "Lädt…" : "Bild hochladen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={onUpload}
                  />
                </label>
                {draft.imageUrl && (
                  <button
                    className="btn-ghost text-danger"
                    onClick={() => {
                      setDraft({ ...draft, imageUrl: null });
                      setUrlValue("");
                      setUploadError(null);
                    }}
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onImportUrl();
                    }
                  }}
                  placeholder="…oder Bild-URL einfügen"
                />
                <button
                  className="btn-ghost whitespace-nowrap"
                  onClick={onImportUrl}
                  disabled={importing || !urlValue.trim()}
                >
                  {importing ? "Lädt…" : "Laden"}
                </button>
              </div>
              <p className="text-xs text-muted">
                Der Link wird heruntergeladen und lokal gespeichert.
              </p>
              {uploadError && (
                <p className="text-xs text-danger">{uploadError}</p>
              )}
            </div>
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
          {/* Keine verschachtelte Scroll-Box mehr; am Handy ±-Buttons statt
              winziger Slider (20 Stufen auf ~90 px) */}
          <div className="space-y-3">
            {Object.entries(groups).map(([group, ms]) => (
              <div key={group}>
                <div className="mb-1 text-xs uppercase tracking-wide text-muted">
                  {group}
                </div>
                <div className="space-y-2">
                  {ms.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm sm:w-36 sm:flex-none">
                        {m.name}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={pctFor(m.id)}
                        onChange={(e) => setPct(m.id, Number(e.target.value))}
                        className="hidden flex-1 sm:block"
                        aria-label={`${m.name} Anteil`}
                      />
                      <button
                        type="button"
                        className="btn-ghost px-3 sm:hidden"
                        onClick={() => setPct(m.id, Math.max(0, pctFor(m.id) - 5))}
                        disabled={pctFor(m.id) === 0}
                        aria-label={`${m.name} minus 5 %`}
                      >
                        −
                      </button>
                      <span
                        className={`w-11 text-center text-sm tabular-nums sm:w-10 sm:text-right ${
                          pctFor(m.id) > 0 ? "font-semibold text-foreground" : "text-muted"
                        }`}
                      >
                        {pctFor(m.id)}%
                      </span>
                      <button
                        type="button"
                        className="btn-ghost px-3 sm:hidden"
                        onClick={() => setPct(m.id, Math.min(100, pctFor(m.id) + 5))}
                        disabled={pctFor(m.id) === 100}
                        aria-label={`${m.name} plus 5 %`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {saveError && <p className="text-sm text-danger">{saveError}</p>}

        {/* Footer klebt unten — Speichern ist ohne Scrollen erreichbar */}
        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 rounded-b-2xl border-t bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button className="btn-ghost" onClick={requestClose}>
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
