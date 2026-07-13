"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REST_PRESETS } from "@/lib/constants";
import {
  startSession,
  finishSession,
  cancelSession,
  drawFunnySaying,
  type SetLogInput,
} from "../actions";

type Ex = {
  planExerciseId: string;
  name: string;
  imageUrl: string | null;
  sets: number;
  targetReps: number | null;
  targetWeight: number | null;
};

type LastLog = { weight: number | null; reps: number | null };
type Phase = "motivation" | "workout" | "exertion" | "done";
type LogVal = { weight: string; reps: string; done?: boolean };

// Zwischenstand pro Plan sichern, damit ein Reload/Tab-Wechsel nichts verliert.
const saveKey = (planId: string) => `gymplan.session.${planId}`;

type SavedState = {
  sessionId: string;
  phase: Phase;
  exIdx: number;
  logs: Record<string, Record<number, LogVal>>;
  motivation: number;
  exertion: number;
};

export default function SessionFlowClient({
  shareToken,
  planId,
  planName,
  clientName,
  exercises,
  lastLogs,
}: {
  shareToken: string;
  planId: string;
  planName: string;
  clientName: string;
  exercises: Ex[];
  lastLogs: Record<string, Record<number, LastLog>>;
}) {
  const router = useRouter();
  const name = clientName;

  // Gespeicherten Zwischenstand (falls vorhanden) synchron beim ersten Render laden
  const [restored] = useState<SavedState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(saveKey(planId));
      if (!raw) return null;
      const s = JSON.parse(raw) as SavedState;
      return s.sessionId && s.phase !== "done" ? s : null;
    } catch {
      return null;
    }
  });

  const [phase, setPhase] = useState<Phase>(restored?.phase ?? "motivation");
  const [motivation, setMotivation] = useState(restored?.motivation ?? 12);
  const [exertion, setExertion] = useState(restored?.exertion ?? 12);
  const [sessionId, setSessionId] = useState<string | null>(
    restored?.sessionId ?? null,
  );
  const [exIdx, setExIdx] = useState(restored?.exIdx ?? 0);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // GainsFire-Popup beim Abschluss-Rating
  const [funny, setFunny] = useState<{ text: string; weight: number } | null>(null);
  const [funnyOpen, setFunnyOpen] = useState(false);

  // logs[planExerciseId][setNumber] = { weight, reps, done }
  // Vorbelegung: Werte vom letzten Training, sonst Plan-Zielwerte.
  const [logs, setLogs] = useState<Record<string, Record<number, LogVal>>>(() => {
    if (restored) return restored.logs;
    const init: Record<string, Record<number, LogVal>> = {};
    for (const ex of exercises) {
      init[ex.planExerciseId] = {};
      for (let s = 1; s <= ex.sets; s++) {
        const last = lastLogs[ex.planExerciseId]?.[s];
        init[ex.planExerciseId][s] = {
          weight:
            last?.weight != null
              ? String(last.weight)
              : ex.targetWeight != null
                ? String(ex.targetWeight)
                : "",
          reps:
            last?.reps != null
              ? String(last.reps)
              : ex.targetReps != null
                ? String(ex.targetReps)
                : "",
        };
      }
    }
    return init;
  });

  // Zwischenstand fortlaufend sichern (ab Workout-Phase, solange nicht fertig)
  useEffect(() => {
    if (!sessionId || phase === "done") return;
    const state: SavedState = { sessionId, phase, exIdx, logs, motivation, exertion };
    try {
      localStorage.setItem(saveKey(planId), JSON.stringify(state));
    } catch {
      /* Speicher voll o.ä. – Recovery ist optional */
    }
  }, [sessionId, phase, exIdx, logs, motivation, exertion, planId]);

  function clearSaved() {
    try {
      localStorage.removeItem(saveKey(planId));
    } catch {
      /* ignore */
    }
  }

  // Bildschirm während des Trainings wach halten (Wake Lock, wo unterstützt)
  useEffect(() => {
    if (phase !== "workout") return;
    let lock: { release: () => Promise<void> } | null = null;
    let active = true;
    async function acquire() {
      try {
        const wl = (navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        if (wl && active) lock = await wl.request("screen");
      } catch {
        /* nicht unterstützt oder verweigert – kein Problem */
      }
    }
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [phase]);

  async function beginWorkout() {
    setBusy(true);
    const { sessionId } = await startSession(planId, motivation);
    setSessionId(sessionId);
    setBusy(false);
    setPhase("workout");
  }

  function setLog(peId: string, setNo: number, field: "weight" | "reps", value: string) {
    setLogs((prev) => ({
      ...prev,
      [peId]: { ...prev[peId], [setNo]: { ...prev[peId][setNo], [field]: value } },
    }));
  }

  function toggleDone(peId: string, setNo: number) {
    setLogs((prev) => ({
      ...prev,
      [peId]: {
        ...prev[peId],
        [setNo]: { ...prev[peId][setNo], done: !prev[peId][setNo].done },
      },
    }));
  }

  // Gesamtgewicht (Σ Gewicht × Wdh., beide gesetzt – wie totalVolume im Verlauf)
  // und Gesamt-Wiederholungen der Session aus den Eingaben berechnen.
  function computeTotals(): { weight: number; reps: number } {
    let weight = 0;
    let reps = 0;
    for (const l of collectLogs()) {
      if (l.reps != null) reps += l.reps;
      if (l.weight != null && l.reps != null) weight += l.weight * l.reps;
    }
    return { weight, reps };
  }

  // Beim Übergang zum Abschluss-Rating den Spruch holen (nicht blockierend).
  function goToExertion() {
    setPhase("exertion");
    if (!sessionId) return;
    drawFunnySaying(sessionId, computeTotals())
      .then((f) => {
        setFunny(f);
        setFunnyOpen(true);
      })
      .catch(() => {
        /* Popup ist optional – Training nie blockieren */
      });
  }

  function collectLogs(): SetLogInput[] {
    const out: SetLogInput[] = [];
    for (const ex of exercises) {
      const perSet = logs[ex.planExerciseId] || {};
      for (let s = 1; s <= ex.sets; s++) {
        const v = perSet[s];
        if (!v) continue;
        const weight = v.weight === "" ? null : Number(v.weight);
        const reps = v.reps === "" ? null : Number(v.reps);
        out.push({ planExerciseId: ex.planExerciseId, setNumber: s, weight, reps });
      }
    }
    return out;
  }

  async function complete() {
    if (!sessionId) return;
    setBusy(true);
    await finishSession(sessionId, exertion, collectLogs());
    setBusy(false);
    clearSaved();
    setPhase("done");
  }

  async function doCancel() {
    if (sessionId) await cancelSession(sessionId);
    clearSaved();
    router.replace(`/t/${shareToken}`);
  }

  // --- Motivation ---
  if (phase === "motivation") {
    return (
      <FlowShell title={planName} subtitle={`Los geht's, ${name}!`}>
        <div className="card space-y-6">
          <ScaleInput
            label="Wie hoch ist deine Motivation?"
            value={motivation}
            onChange={setMotivation}
          />
          <button
            className="btn-primary w-full py-3.5 text-base"
            onClick={beginWorkout}
            disabled={busy}
          >
            {busy ? "Startet…" : "Training starten"}
          </button>
        </div>
      </FlowShell>
    );
  }

  // --- Exertion (Abschluss) ---
  if (phase === "exertion") {
    return (
      <FlowShell title={planName} subtitle="Fast geschafft">
        {/* GainsFire-Popup: Gesamtgewicht + Spruch */}
        {funnyOpen && funny && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="card w-full max-w-sm space-y-4 text-center animate-pop-in">
              <div className="text-4xl">🔥</div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted">
                  Heute bewegt
                </div>
                <div className="mt-1 text-4xl font-black tabular-nums text-accent">
                  {funny.weight.toLocaleString("de-DE")}
                  <span className="text-lg font-medium text-muted"> kg</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{funny.text}</p>
              <button
                className="btn-primary w-full"
                onClick={() => setFunnyOpen(false)}
              >
                Weiter
              </button>
            </div>
          </div>
        )}
        <div className="card space-y-6">
          <ScaleInput
            label="Wie anstrengend war das Training?"
            value={exertion}
            onChange={setExertion}
          />
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={() => setPhase("workout")}
              disabled={busy}
            >
              Zurück
            </button>
            <button
              className="btn-primary flex-1"
              onClick={complete}
              disabled={busy}
            >
              {busy ? "Speichert…" : "Abschließen"}
            </button>
          </div>
        </div>
      </FlowShell>
    );
  }

  // --- Done ---
  if (phase === "done") {
    return (
      <FlowShell title="Stark! 💪" subtitle={planName}>
        <div className="card space-y-4 text-center">
          <p className="text-muted">
            Training abgeschlossen. Motivation {motivation}/20 · Anstrengung{" "}
            {exertion}/20.
          </p>
          <button
            className="btn-primary w-full"
            onClick={() => router.replace(`/t/${shareToken}/history`)}
          >
            📈 Verlauf ansehen
          </button>
          <button
            className="btn-ghost w-full"
            onClick={() => router.replace(`/t/${shareToken}`)}
          >
            Zurück zum Plan
          </button>
        </div>
      </FlowShell>
    );
  }

  // --- Workout ---
  const ex = exercises[exIdx];
  const isLast = exIdx === exercises.length - 1;

  // "Letztes Mal"-Zusammenfassung für die aktuelle Übung, z.B. "50×10 · 50×8"
  const lastForEx = lastLogs[ex.planExerciseId];
  const lastSummary = lastForEx
    ? Object.keys(lastForEx)
        .map(Number)
        .sort((a, b) => a - b)
        .map((s) => {
          const l = lastForEx[s];
          return `${l.weight ?? "–"}×${l.reps ?? "–"}`;
        })
        .join(" · ")
    : null;

  return (
    <FlowShell
      title={planName}
      subtitle={`Übung ${exIdx + 1} von ${exercises.length}`}
      onCancel={() => setConfirmCancel(true)}
      progress={(exIdx) / Math.max(1, exercises.length)}
    >
      <div className="card space-y-4">
        {ex.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ex.imageUrl}
            alt={`So geht ${ex.name}`}
            className="max-h-56 w-full rounded-xl border bg-white object-contain"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold">{ex.name}</h2>
          <p className="text-sm text-muted">
            Ziel: {ex.sets} Sätze
            {ex.targetReps ? ` × ${ex.targetReps} Wdh.` : ""}
            {ex.targetWeight ? ` · ${ex.targetWeight} kg` : ""}
          </p>
          {lastSummary && (
            <p className="mt-0.5 text-sm text-accent">
              Letztes Mal: {lastSummary}
            </p>
          )}
        </div>

        {/* Satz-Zeilen */}
        <div className="space-y-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs uppercase tracking-wide text-muted">
            <span>Satz</span>
            <span>Gewicht (kg)</span>
            <span>Wdh.</span>
            <span className="text-center">✓</span>
          </div>
          {Array.from({ length: ex.sets }, (_, i) => i + 1).map((s) => {
            const v = logs[ex.planExerciseId][s];
            return (
              <div
                key={s}
                className={`grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 rounded-xl transition-opacity ${
                  v.done ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold ${
                    v.done ? "bg-accent-soft text-accent" : "bg-surface-2"
                  }`}
                >
                  {s}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  step={0.5}
                  value={v.weight}
                  onChange={(e) =>
                    setLog(ex.planExerciseId, s, "weight", e.target.value)
                  }
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  value={v.reps}
                  onChange={(e) =>
                    setLog(ex.planExerciseId, s, "reps", e.target.value)
                  }
                />
                <button
                  type="button"
                  aria-label={`Satz ${s} ${v.done ? "wieder öffnen" : "abhaken"}`}
                  onClick={() => toggleDone(ex.planExerciseId, s)}
                  className={`grid h-10 w-10 place-items-center rounded-xl border text-lg transition-colors ${
                    v.done
                      ? "border-accent bg-accent text-black"
                      : "border-border bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  ✓
                </button>
              </div>
            );
          })}
        </div>

        <RestTimer />

        {/* Navigation */}
        <div className="flex gap-2 pt-1">
          <button
            className="btn-ghost flex-1"
            onClick={() => setExIdx((i) => Math.max(0, i - 1))}
            disabled={exIdx === 0}
          >
            ← Zurück
          </button>
          {isLast ? (
            <button className="btn-primary flex-1" onClick={goToExertion}>
              Training abschließen
            </button>
          ) : (
            <button
              className="btn-primary flex-1"
              onClick={() => setExIdx((i) => Math.min(exercises.length - 1, i + 1))}
            >
              Nächste Übung →
            </button>
          )}
        </div>
      </div>

      {/* Abbrechen-Bestätigung */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-4 text-center">
            <h3 className="text-lg font-semibold">Training wirklich abbrechen?</h3>
            <p className="text-sm text-muted">
              Dein bisheriger Fortschritt wird nicht als abgeschlossen gewertet.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1"
                onClick={() => setConfirmCancel(false)}
              >
                Weitermachen
              </button>
              <button className="btn-danger flex-1" onClick={doCancel}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </FlowShell>
  );
}

// --- Shell -------------------------------------------------------------
function FlowShell({
  title,
  subtitle,
  children,
  onCancel,
  progress,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onCancel?: () => void;
  progress?: number;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">{title}</div>
          {subtitle && <div className="text-lg font-bold">{subtitle}</div>}
        </div>
        {onCancel && (
          <button className="btn-ghost text-danger" onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
      {progress != null && (
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {children}
    </main>
  );
}

// --- 1–20 Skala --------------------------------------------------------
function ScaleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 text-center">
        <div className="text-sm text-muted">{label}</div>
        <div className="mt-1 text-5xl font-black text-accent tabular-nums">
          {value}
          <span className="text-xl text-muted">/20</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={20}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>1</span>
        <span>20</span>
      </div>
    </div>
  );
}

// --- Pausen-Timer ------------------------------------------------------
function RestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          notifyDone();
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function start(sec: number) {
    setRemaining(sec);
    setRunning(true);
  }
  function stop() {
    setRunning(false);
    setRemaining(0);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="card-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">
          Pausen-Timer
        </span>
        {running && (
          <span className="text-2xl font-black tabular-nums text-accent">
            {mm}:{ss}
          </span>
        )}
      </div>
      {running ? (
        <button className="btn-ghost w-full" onClick={stop}>
          Timer überspringen
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {REST_PRESETS.map((sec) => (
            <button key={sec} className="btn-ghost" onClick={() => start(sec)}>
              {sec}s
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function notifyDone() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 80, 200]);
    }
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setTimeout(() => ctx.close(), 600);
    }
  } catch {
    /* ignore */
  }
}
