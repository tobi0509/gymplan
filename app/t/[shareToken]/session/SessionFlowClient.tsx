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
  isCardio: boolean;
};

type LastLog = {
  weight: number | null;
  reps: number | null;
  durationMin: number | null;
};
type Phase = "motivation" | "workout" | "exertion" | "done";
type LogVal = {
  weight: string;
  reps: string;
  durationMin: string;
  done?: boolean;
};

// Laufender Cardio-Countdown (max. einer gleichzeitig). endsAt-basiert statt
// Sekunden-Dekrement — übersteht Tab-Throttling und Reloads.
type CardioTimer = {
  peId: string;
  setNo: number;
  endsAt: number; // Epoch-ms
  totalSec: number;
};

// Zwischenstand pro Plan sichern, damit ein Reload/Tab-Wechsel nichts verliert.
const saveKey = (planId: string) => `gymplan.session.${planId}`;

// Älterer Zwischenstand wird verworfen: ein Wochen später "fortgesetztes"
// Training würde sonst mit uralter startedAt-Zeit abgeschlossen (absurde
// Dauer/Kalorien im Verlauf, Häkchen in der falschen Woche).
const RESTORE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SavedState = {
  sessionId: string;
  phase: Phase;
  exIdx: number;
  logs: Record<string, Record<number, LogVal>>;
  motivation: number;
  exertion: number;
  clientName?: string; // Gerät kann geteilt sein — Stand gehört zu einem Account
  savedAt?: number;
  timer?: CardioTimer;
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

  const [phase, setPhase] = useState<Phase>("motivation");
  const [motivation, setMotivation] = useState(12);
  const [exertion, setExertion] = useState(12);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exIdx, setExIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // GainsFire-Popup beim Abschluss-Rating
  const [funny, setFunny] = useState<{ text: string; weight: number } | null>(null);
  const [funnyOpen, setFunnyOpen] = useState(false);
  const [timer, setTimer] = useState<CardioTimer | null>(null);
  const [timerNow, setTimerNow] = useState(0); // ticked jede Sekunde, treibt die Restzeit-Anzeige

  // logs[planExerciseId][setNumber] = { weight, reps, done }
  // Vorbelegung: Werte vom letzten Training, sonst Plan-Zielwerte.
  function defaultLogs(): Record<string, Record<number, LogVal>> {
    const init: Record<string, Record<number, LogVal>> = {};
    for (const ex of exercises) {
      init[ex.planExerciseId] = {};
      for (let s = 1; s <= ex.sets; s++) {
        const last = lastLogs[ex.planExerciseId]?.[s];
        init[ex.planExerciseId][s] = ex.isCardio
          ? {
              weight: "",
              reps: "",
              // targetReps hält bei Cardio-Übungen die Ziel-Minuten
              durationMin:
                last?.durationMin != null
                  ? String(last.durationMin)
                  : ex.targetReps != null
                    ? String(ex.targetReps)
                    : "",
            }
          : {
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
              durationMin: "",
            };
      }
    }
    return init;
  }
  const [logs, setLogs] = useState<Record<string, Record<number, LogVal>>>(defaultLogs);

  // Gespeicherten Zwischenstand nach dem Mount wiederherstellen (nicht im
  // useState-Initializer: der liefe schon beim Hydrieren und erzeugte einen
  // Hydration-Mismatch zwischen Server- und Client-HTML).
  useEffect(() => {
    let s: SavedState | null = null;
    try {
      const raw = localStorage.getItem(saveKey(planId));
      if (raw) s = JSON.parse(raw) as SavedState;
    } catch {
      s = null;
    }
    if (!s || !s.sessionId || s.phase === "done") return;
    // Zwischenstand eines anderen Accounts (geteiltes Gerät) oder zu alt →
    // verwerfen, sonst würde ein fremdes/uraltes Training "fortgesetzt".
    if (
      (s.clientName != null && s.clientName !== clientName) ||
      (s.savedAt != null && Date.now() - s.savedAt > RESTORE_MAX_AGE_MS)
    ) {
      clearSaved();
      return;
    }
    // Struktur immer vom aktuellen Plan — hat der Trainer inzwischen
    // Übungen/Sätze geändert, fehlen sonst Einträge und das Rendering
    // stürzt ab. Gespeicherte Werte nur über die Defaults legen.
    const merged = defaultLogs();
    for (const ex of exercises) {
      const savedPerSet = s.logs?.[ex.planExerciseId];
      if (!savedPerSet) continue;
      for (let set = 1; set <= ex.sets; set++) {
        const v = savedPerSet[set];
        if (!v) continue;
        merged[ex.planExerciseId][set] = {
          weight: v.weight ?? "",
          reps: v.reps ?? "",
          durationMin: v.durationMin ?? "",
          done: v.done,
        };
      }
    }
    // Lief beim Reload ein Cardio-Timer? Nur übernehmen, wenn die Zeit noch
    // nicht abgelaufen ist — sonst gilt der Satz als (mit Ziel-Minuten)
    // abgeschlossen, statt einen Timer bei 0:00 hängen zu lassen.
    if (s.timer && s.timer.endsAt > Date.now()) {
      setTimer(s.timer);
    } else if (s.timer) {
      const perSet = merged[s.timer.peId];
      if (perSet?.[s.timer.setNo]) {
        perSet[s.timer.setNo] = {
          ...perSet[s.timer.setNo],
          durationMin: String(Math.round(s.timer.totalSec / 60)),
          done: true,
        };
      }
    }
    setLogs(merged);
    setSessionId(s.sessionId);
    setPhase(s.phase);
    setMotivation(s.motivation ?? 12);
    setExertion(s.exertion ?? 12);
    // exIdx klammern: der Plan kann seit dem Zwischenstand kürzer geworden sein
    setExIdx(Math.max(0, Math.min(s.exIdx ?? 0, exercises.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zwischenstand fortlaufend sichern (ab Workout-Phase, solange nicht fertig)
  useEffect(() => {
    if (!sessionId || phase === "done") return;
    const state: SavedState = {
      sessionId,
      phase,
      exIdx,
      logs,
      motivation,
      exertion,
      clientName,
      savedAt: Date.now(),
      timer: timer ?? undefined,
    };
    try {
      localStorage.setItem(saveKey(planId), JSON.stringify(state));
    } catch {
      /* Speicher voll o.ä. – Recovery ist optional */
    }
  }, [sessionId, phase, exIdx, logs, motivation, exertion, planId, clientName, timer]);

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
    setActionError(false);
    try {
      const { sessionId } = await startSession(planId, motivation);
      setSessionId(sessionId);
      setPhase("workout");
    } catch {
      // Offline o.ä. — Button wieder freigeben statt auf "Startet…" zu hängen
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  function setLog(
    peId: string,
    setNo: number,
    field: "weight" | "reps" | "durationMin",
    value: string,
  ) {
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

  // Cardio-Countdown: läuft die Zeit ab, wird der geplante Minutenwert
  // gespeichert und der Satz automatisch abgehakt. endsAt-basiert (nicht
  // dekrementiert) — bleibt auch bei gedrosselten Hintergrund-Tabs korrekt.
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer) return;
    if (Date.now() < timer.endsAt) return;
    const plannedMin = Math.round(timer.totalSec / 60);
    setLogs((prev) => ({
      ...prev,
      [timer.peId]: {
        ...prev[timer.peId],
        [timer.setNo]: {
          ...prev[timer.peId][timer.setNo],
          durationMin: String(plannedMin),
          done: true,
        },
      },
    }));
    notifyDone();
    setTimer(null);
    // timerNow treibt den Ablauf-Check jede Sekunde erneut an
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, timerNow]);

  function startCardioTimer(peId: string, setNo: number, minutes: number) {
    if (minutes <= 0) return;
    setTimer({ peId, setNo, endsAt: Date.now() + minutes * 60000, totalSec: minutes * 60 });
  }

  // Vorzeitiges Beenden: tatsächlich absolvierte Minuten speichern
  // (aufgerundet, mindestens 1), Satz abhaken.
  function stopCardioTimer() {
    if (!timer) return;
    const elapsedSec = timer.totalSec - Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
    const elapsedMin = Math.max(1, Math.ceil(elapsedSec / 60));
    setLogs((prev) => ({
      ...prev,
      [timer.peId]: {
        ...prev[timer.peId],
        [timer.setNo]: {
          ...prev[timer.peId][timer.setNo],
          durationMin: String(elapsedMin),
          done: true,
        },
      },
    }));
    setTimer(null);
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
        out.push(
          ex.isCardio
            ? {
                planExerciseId: ex.planExerciseId,
                setNumber: s,
                weight: null,
                reps: null,
                durationMin: v.durationMin === "" ? null : Number(v.durationMin),
              }
            : {
                planExerciseId: ex.planExerciseId,
                setNumber: s,
                weight: v.weight === "" ? null : Number(v.weight),
                reps: v.reps === "" ? null : Number(v.reps),
                durationMin: null,
              },
        );
      }
    }
    return out;
  }

  async function complete() {
    if (!sessionId) return;
    setBusy(true);
    setActionError(false);
    try {
      await finishSession(sessionId, exertion, collectLogs());
      clearSaved();
      setPhase("done");
    } catch {
      // Eingaben bleiben erhalten (localStorage) — nur Fehler zeigen
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    try {
      if (sessionId) await cancelSession(sessionId);
    } catch {
      // Session ggf. fremd oder offline — lokalen Stand trotzdem verwerfen,
      // sonst hängt der Abbrechen-Dialog dauerhaft fest.
    }
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
          {actionError && (
            <p className="text-center text-sm text-danger">
              Das hat nicht geklappt — bitte Verbindung prüfen und nochmal
              versuchen.
            </p>
          )}
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
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-safe backdrop-blur-sm">
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
          {actionError && (
            <p className="text-center text-sm text-danger">
              Speichern fehlgeschlagen — deine Eingaben sind gesichert, bitte
              nochmal versuchen.
            </p>
          )}
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

  // "Letztes Mal"-Zusammenfassung für die aktuelle Übung,
  // z.B. "50×10 · 50×8" bzw. bei Cardio "20 min"
  const lastForEx = lastLogs[ex.planExerciseId];
  const lastSummary = lastForEx
    ? Object.keys(lastForEx)
        .map(Number)
        .sort((a, b) => a - b)
        .map((s) => {
          const l = lastForEx[s];
          if (l.durationMin != null) return `${l.durationMin} min`;
          return `${l.weight ?? "–"}×${l.reps ?? "–"}`;
        })
        .join(" · ")
    : null;

  // Laufender Cardio-Timer: Restzeit + Fortschritt fürs Rendering ableiten
  const timerRemainingSec = timer
    ? Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000))
    : 0;
  const timerMM = String(Math.floor(timerRemainingSec / 60)).padStart(1, "0");
  const timerSS = String(timerRemainingSec % 60).padStart(2, "0");
  const timerPct = timer
    ? Math.max(
        0,
        Math.min(100, ((timer.totalSec - timerRemainingSec) / timer.totalSec) * 100),
      )
    : 0;

  // Fortschritt = abgehakte Sätze über alle Übungen
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = exercises.reduce((sum, e) => {
    let n = 0;
    for (let s = 1; s <= e.sets; s++) {
      if (logs[e.planExerciseId]?.[s]?.done) n++;
    }
    return sum + n;
  }, 0);
  const progress = totalSets > 0 ? doneSets / totalSets : 0;

  return (
    <FlowShell
      title={planName}
      subtitle={`Übung ${exIdx + 1} von ${exercises.length}`}
      onCancel={() => setConfirmCancel(true)}
      progress={progress}
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
          {ex.isCardio ? (
            <p className="text-sm text-muted">
              Ziel: {ex.sets > 1 ? `${ex.sets} × ` : ""}
              {ex.targetReps ?? "–"} min
            </p>
          ) : (
            <p className="text-sm text-muted">
              Ziel: {ex.sets} Sätze
              {ex.targetReps ? ` × ${ex.targetReps} Wdh.` : ""}
              {ex.targetWeight ? ` · ${ex.targetWeight} kg` : ""}
            </p>
          )}
          {lastSummary && (
            <p className="mt-0.5 text-sm text-accent">
              Letztes Mal: {lastSummary}
            </p>
          )}
        </div>

        {/* Satz-Zeilen */}
        <div className="space-y-2">
          <div
            className={`grid ${
              ex.isCardio
                ? "grid-cols-[2rem_1fr_auto_2.5rem]"
                : "grid-cols-[2rem_1fr_1fr_2.5rem]"
            } gap-2 px-1 text-xs uppercase tracking-wide text-muted`}
          >
            <span>Satz</span>
            <span>{ex.isCardio ? "Minuten" : "Gewicht (kg)"}</span>
            <span>{ex.isCardio ? "" : "Wdh."}</span>
            <span className="text-center">✓</span>
          </div>
          {Array.from({ length: ex.sets }, (_, i) => i + 1).map((s) => {
            const v = logs[ex.planExerciseId][s];
            const isRunningHere =
              ex.isCardio && timer?.peId === ex.planExerciseId && timer?.setNo === s;
            return (
              <div
                key={s}
                className={`grid ${
                  ex.isCardio
                    ? "grid-cols-[2rem_1fr_auto_2.5rem]"
                    : "grid-cols-[2rem_1fr_1fr_2.5rem]"
                } items-center gap-2 rounded-xl transition-opacity ${
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
                {ex.isCardio ? (
                  isRunningHere ? (
                    <div className="col-span-3 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted">Läuft…</span>
                          <span className="text-xl font-black tabular-nums text-accent">
                            {timerMM}:{timerSS}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${timerPct}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost shrink-0 px-3 py-2 text-sm"
                        onClick={stopCardioTimer}
                      >
                        Beenden
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="input"
                        value={v.durationMin}
                        onChange={(e) =>
                          setLog(ex.planExerciseId, s, "durationMin", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-sm"
                        disabled={
                          timer != null ||
                          v.durationMin === "" ||
                          Number(v.durationMin) <= 0
                        }
                        onClick={() =>
                          startCardioTimer(ex.planExerciseId, s, Number(v.durationMin))
                        }
                      >
                        ▶ Start
                      </button>
                    </>
                  )
                ) : (
                  <>
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
                  </>
                )}
                {!isRunningHere && (
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
                )}
              </div>
            );
          })}
        </div>

        <RestTimer />
      </div>

      {/* Navigation — klebt am unteren Rand, mit Daumen immer erreichbar.
          sticky statt fixed: fixed springt unter iOS mit offener Tastatur mit. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-3 border-t bg-base/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1 py-3"
            onClick={() => setExIdx((i) => Math.max(0, i - 1))}
            disabled={exIdx === 0}
          >
            ← Zurück
          </button>
          {isLast ? (
            <button className="btn-primary flex-1 py-3" onClick={goToExertion}>
              Training abschließen
            </button>
          ) : (
            <button
              className="btn-primary flex-1 py-3"
              onClick={() => setExIdx((i) => Math.min(exercises.length - 1, i + 1))}
            >
              Nächste Übung →
            </button>
          )}
        </div>
      </div>

      {/* Abbrechen-Bestätigung */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-safe backdrop-blur-sm">
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
    <main className="mx-auto max-w-md px-4 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
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
        <div className="mb-5">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">Fortschritt</span>
            <span className="font-semibold tabular-nums text-accent">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
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
