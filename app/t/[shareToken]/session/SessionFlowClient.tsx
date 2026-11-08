"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REST_PRESETS } from "@/lib/constants";
import {
  startSession,
  finishSession,
  cancelSession,
  drawFunnySaying,
  saveExerciseNote,
  type SetLogInput,
} from "../actions";

type Ex = {
  planExerciseId: string;
  exerciseId: string;
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
type Note = { text: string; updatedAt: string };

// Laufender Cardio-Countdown (max. einer gleichzeitig). endsAt-basiert statt
// Sekunden-Dekrement — übersteht Tab-Throttling und Reloads.
type CardioTimer = {
  peId: string;
  setNo: number;
  endsAt: number; // Epoch-ms
  totalSec: number;
};

// Pausen-Timer — ebenfalls endsAt-basiert, damit er bei gesperrtem
// Bildschirm/Musik-App im Vordergrund nicht stehen bleibt.
type RestTimer = { endsAt: number; totalSec: number };

// Zwischenstand pro Plan sichern, damit ein Reload/Tab-Wechsel nichts verliert.
const saveKey = (planId: string) => `gymplan.session.${planId}`;

// Älterer Zwischenstand wird verworfen: ein Wochen später "fortgesetztes"
// Training würde sonst mit uralter startedAt-Zeit abgeschlossen (absurde
// Dauer/Kalorien im Verlauf, Häkchen in der falschen Woche).
const RESTORE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_REST: number = REST_PRESETS[1] ?? REST_PRESETS[0];
const NOTE_MAX_LEN = 1000;
const WEIGHT_STEP = 2.5;

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
  rest?: RestTimer;
  restPreset?: number;
  onlyDone?: boolean;
  noteDrafts?: Record<string, string>; // exerciseId → noch nicht gespeicherter Text
};

// Deutsche Tastaturen liefern "22,5" — beides akzeptieren.
function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function SessionFlowClient({
  shareToken,
  planId,
  planName,
  clientName,
  exercises,
  lastLogs,
  maxWeights,
  notes: initialNotes,
}: {
  shareToken: string;
  planId: string;
  planName: string;
  clientName: string;
  exercises: Ex[];
  lastLogs: Record<string, Record<number, LastLog>>;
  maxWeights: Record<string, number>;
  notes: Record<string, Note>;
}) {
  const router = useRouter();
  const name = clientName;

  // Bis der localStorage-Zwischenstand geprüft ist, nichts rendern — sonst
  // blitzt nach einem Reload kurz der Motivations-Screen auf und ein schneller
  // Tap startet eine zweite Session.
  const [restored, setRestored] = useState(false);
  const [phase, setPhase] = useState<Phase>("motivation");
  const [motivation, setMotivation] = useState(12);
  const [exertion, setExertion] = useState(12);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exIdx, setExIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Abschluss mit offenen (nicht abgehakten) Sätzen → nachfragen
  const [confirmOpenSets, setConfirmOpenSets] = useState(0);
  const [onlyDone, setOnlyDone] = useState(false);
  // GainsFire-Popup beim Abschluss-Rating
  const [funny, setFunny] = useState<{ text: string; weight: number } | null>(null);
  const [funnyOpen, setFunnyOpen] = useState(false);
  const [timer, setTimer] = useState<CardioTimer | null>(null);
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [restPreset, setRestPreset] = useState<number>(DEFAULT_REST);
  const [restDoneFlash, setRestDoneFlash] = useState(false);
  const [tick, setTick] = useState(0); // tickt jede Sekunde, solange ein Timer läuft

  // Übungs-Notizen (exerciseId → Notiz) + Bearbeitungs-Sheet
  const [notes, setNotes] = useState<Record<string, Note>>(initialNotes);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "error">("idle");
  // Satz, auf den die ±-Buttons wirken (null = erster offener Satz)
  const [activeSetNo, setActiveSetNo] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // logs[planExerciseId][setNumber] = { weight, reps, done }
  // Vorbelegung Gewicht: maximal je erreichtes Gewicht für diese Übung (über
  // alle Pläne hinweg), sonst Plan-Zielgewicht — bewusst NICHT das letzte
  // Training, sonst ginge eine schwächere letzte Einheit als Referenz verloren.
  // Vorbelegung Wdh./Cardio-Minuten: weiterhin vom letzten Training.
  function defaultLogs(): Record<string, Record<number, LogVal>> {
    const init: Record<string, Record<number, LogVal>> = {};
    for (const ex of exercises) {
      init[ex.planExerciseId] = {};
      const maxWeight = maxWeights[ex.exerciseId];
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
                maxWeight != null
                  ? String(maxWeight)
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
    restore();
    setRestored(true);

    function restore() {
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
      if (s.rest && s.rest.endsAt > Date.now()) setRest(s.rest);
      if (s.restPreset) setRestPreset(s.restPreset);
      if (s.noteDrafts) setNoteDrafts(s.noteDrafts);
      setOnlyDone(!!s.onlyDone);
      setLogs(merged);
      setSessionId(s.sessionId);
      setPhase(s.phase);
      setMotivation(s.motivation ?? 12);
      setExertion(s.exertion ?? 12);
      // exIdx klammern: der Plan kann seit dem Zwischenstand kürzer geworden sein
      setExIdx(Math.max(0, Math.min(s.exIdx ?? 0, exercises.length - 1)));
    }
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
      rest: rest ?? undefined,
      restPreset,
      onlyDone,
      noteDrafts,
    };
    try {
      localStorage.setItem(saveKey(planId), JSON.stringify(state));
    } catch {
      /* Speicher voll o.ä. – Recovery ist optional */
    }
  }, [
    sessionId,
    phase,
    exIdx,
    logs,
    motivation,
    exertion,
    planId,
    clientName,
    timer,
    rest,
    restPreset,
    onlyDone,
    noteDrafts,
  ]);

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
    unlockAudio();
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

  // Abhaken eines Kraft-Satzes startet automatisch die Pause mit dem zuletzt
  // gewählten Preset — spart pro Satz einen Tap.
  function toggleDone(ex: Ex, setNo: number) {
    unlockAudio();
    const wasDone = !!logs[ex.planExerciseId]?.[setNo]?.done;
    setLogs((prev) => ({
      ...prev,
      [ex.planExerciseId]: {
        ...prev[ex.planExerciseId],
        [setNo]: {
          ...prev[ex.planExerciseId][setNo],
          done: !prev[ex.planExerciseId][setNo].done,
        },
      },
    }));
    if (!wasDone && !ex.isCardio) startRest(restPreset);
    // Nach dem Abhaken springen die ±-Buttons automatisch zum nächsten offenen Satz
    if (!wasDone) setActiveSetNo(null);
  }

  // ±-Buttons: Wert des aktiven Satzes ändern. Beim Gewicht ziehen folgende,
  // noch offene Sätze mit demselben alten Wert mit — wer die Hantel schwerer
  // macht, will das meist für alle restlichen Sätze.
  function bump(ex: Ex, setNo: number, field: "weight" | "reps" | "durationMin", delta: number) {
    setLogs((prev) => {
      const perSet = { ...prev[ex.planExerciseId] };
      const old = perSet[setNo][field];
      const next = String(Math.max(0, Math.round(((parseNum(old) ?? 0) + delta) * 100) / 100));
      perSet[setNo] = { ...perSet[setNo], [field]: next };
      if (field === "weight") {
        for (let n = setNo + 1; n <= ex.sets; n++) {
          if (!perSet[n].done && perSet[n].weight === old) {
            perSet[n] = { ...perSet[n], weight: next };
          }
        }
      }
      return { ...prev, [ex.planExerciseId]: perSet };
    });
  }

  function startRest(sec: number) {
    unlockAudio();
    setRestPreset(sec);
    setRestDoneFlash(false);
    setRest({ endsAt: Date.now() + sec * 1000, totalSec: sec });
  }

  // Ein Ticker für beide Timer; Restzeiten werden aus endsAt abgeleitet.
  const anyTimer = timer != null || rest != null;
  useEffect(() => {
    if (!anyTimer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [anyTimer]);

  // Ablauf-Checks — tick treibt sie jede Sekunde erneut an
  useEffect(() => {
    // Cardio-Countdown: läuft die Zeit ab, wird der geplante Minutenwert
    // gespeichert und der Satz automatisch abgehakt.
    if (timer && Date.now() >= timer.endsAt) {
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
    }
    if (rest && Date.now() >= rest.endsAt) {
      notifyDone();
      setRest(null);
      setRestDoneFlash(true);
    }
  }, [timer, rest, tick]);

  // "Pause vorbei"-Hinweis nach ein paar Sekunden wieder ausblenden
  useEffect(() => {
    if (!restDoneFlash) return;
    const id = setTimeout(() => setRestDoneFlash(false), 4000);
    return () => clearTimeout(id);
  }, [restDoneFlash]);

  function startCardioTimer(peId: string, setNo: number, minutes: number) {
    if (minutes <= 0) return;
    unlockAudio();
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

  // --- Notizen ---
  function openNote(exerciseId: string) {
    setNoteStatus("idle");
    setNoteOpenFor(exerciseId);
  }
  function noteText(exerciseId: string): string {
    return noteDrafts[exerciseId] ?? notes[exerciseId]?.text ?? "";
  }
  function editNote(exerciseId: string, text: string) {
    setNoteDrafts((d) => ({ ...d, [exerciseId]: text.slice(0, NOTE_MAX_LEN) }));
  }
  function dropDraft(exerciseId: string) {
    setNoteDrafts((d) => {
      const next = { ...d };
      delete next[exerciseId];
      return next;
    });
  }
  function closeNote() {
    // Schließen = Änderungen verwerfen — außer das Speichern ist
    // fehlgeschlagen, dann bleibt der Entwurf (inkl. Reload-Schutz) erhalten.
    if (noteOpenFor && noteStatus !== "error") dropDraft(noteOpenFor);
    setNoteOpenFor(null);
  }
  async function saveNote() {
    if (!noteOpenFor) return;
    const exerciseId = noteOpenFor;
    setNoteStatus("saving");
    try {
      const res = await saveExerciseNote(exerciseId, noteText(exerciseId));
      setNotes((n) => {
        const next = { ...n };
        if (res.updatedAt) next[exerciseId] = { text: res.text, updatedAt: res.updatedAt };
        else delete next[exerciseId];
        return next;
      });
      dropDraft(exerciseId);
      setNoteStatus("idle");
      setNoteOpenFor(null);
    } catch {
      setNoteStatus("error");
    }
  }

  function goToExercise(i: number) {
    setNoteOpenFor(null);
    setActiveSetNo(null);
    setExIdx(Math.max(0, Math.min(exercises.length - 1, i)));
  }

  // Gesamtgewicht (Σ Gewicht × Wdh., beide gesetzt – wie totalVolume im Verlauf)
  // und Gesamt-Wiederholungen der Session aus den Eingaben berechnen.
  function computeTotals(only: boolean): { weight: number; reps: number } {
    let weight = 0;
    let reps = 0;
    for (const l of collectLogs(only)) {
      if (l.reps != null) reps += l.reps;
      if (l.weight != null && l.reps != null) weight += l.weight * l.reps;
    }
    return { weight, reps };
  }

  // Offene Sätze sind vorbefüllt — ungefragt gespeichert würden sie den
  // Verlauf mit nie gemachten Sätzen verfälschen. Daher nachfragen.
  function requestFinish() {
    const open = totalSets - doneSets;
    if (open > 0) {
      setConfirmOpenSets(open);
      return;
    }
    goToExertion(false);
  }

  // Beim Übergang zum Abschluss-Rating den Spruch holen (nicht blockierend).
  function goToExertion(only: boolean) {
    setConfirmOpenSets(0);
    setOnlyDone(only);
    setRest(null);
    setPhase("exertion");
    if (!sessionId) return;
    drawFunnySaying(sessionId, computeTotals(only))
      .then((f) => {
        setFunny(f);
        setFunnyOpen(true);
      })
      .catch(() => {
        /* Popup ist optional – Training nie blockieren */
      });
  }

  function collectLogs(only: boolean): SetLogInput[] {
    const out: SetLogInput[] = [];
    for (const ex of exercises) {
      const perSet = logs[ex.planExerciseId] || {};
      for (let s = 1; s <= ex.sets; s++) {
        const v = perSet[s];
        if (!v) continue;
        if (only && !v.done) continue;
        out.push(
          ex.isCardio
            ? {
                planExerciseId: ex.planExerciseId,
                setNumber: s,
                weight: null,
                reps: null,
                durationMin: parseNum(v.durationMin),
              }
            : {
                planExerciseId: ex.planExerciseId,
                setNumber: s,
                weight: parseNum(v.weight),
                reps: parseNum(v.reps),
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
      await finishSession(sessionId, exertion, collectLogs(onlyDone));
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

  // Aktuelle Übung in der Sprungleiste sichtbar halten
  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [exIdx, phase]);

  if (!restored) {
    return (
      <FlowShell title={planName}>
        <div className="card grid h-40 place-items-center text-sm text-muted">
          Lädt…
        </div>
      </FlowShell>
    );
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
          {onlyDone && (
            <p className="text-center text-xs text-muted">
              Es werden nur abgehakte Sätze gespeichert.
            </p>
          )}
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
  const hasNote = !!notes[ex.exerciseId];
  const hasDraft = noteDrafts[ex.exerciseId] != null;

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

  // Laufende Timer: Restzeit + Fortschritt fürs Rendering ableiten
  const timerRemainingSec = timer
    ? Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000))
    : 0;
  const timerPct = timer
    ? Math.max(
        0,
        Math.min(100, ((timer.totalSec - timerRemainingSec) / timer.totalSec) * 100),
      )
    : 0;
  const restRemainingSec = rest
    ? Math.max(0, Math.round((rest.endsAt - Date.now()) / 1000))
    : 0;
  const restPct = rest
    ? Math.max(0, Math.min(100, (restRemainingSec / rest.totalSec) * 100))
    : 0;

  // Satz für die ±-Buttons: gewählter, sonst erster offener, sonst letzter
  const activeSet =
    activeSetNo != null && activeSetNo <= ex.sets
      ? activeSetNo
      : (Array.from({ length: ex.sets }, (_, i) => i + 1).find(
          (n) => !logs[ex.planExerciseId][n]?.done,
        ) ?? ex.sets);

  // Status je Übung für die Sprungleiste
  const exStatus = (e: Ex): "done" | "partial" | "open" => {
    let n = 0;
    for (let s = 1; s <= e.sets; s++) if (logs[e.planExerciseId]?.[s]?.done) n++;
    return n === 0 ? "open" : n >= e.sets ? "done" : "partial";
  };

  const gridCols = ex.isCardio
    ? "grid-cols-[2rem_1fr_auto_3rem]"
    : "grid-cols-[2rem_1fr_1fr_3rem]";

  return (
    <FlowShell
      title={planName}
      subtitle={`Übung ${exIdx + 1} von ${exercises.length}`}
      onCancel={() => setConfirmCancel(true)}
      progress={progress}
    >
      {/* Sprungleiste: alle Übungen mit Status, direkt antippbar */}
      {exercises.length > 1 && (
        <div
          ref={stripRef}
          className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none]"
          role="list"
          aria-label="Übungen"
        >
          {exercises.map((e, i) => {
            const st = exStatus(e);
            const current = i === exIdx;
            return (
              <button
                key={e.planExerciseId}
                type="button"
                role="listitem"
                aria-current={current ? "step" : undefined}
                aria-label={`Übung ${i + 1}: ${e.name}${
                  st === "done" ? " (erledigt)" : st === "partial" ? " (begonnen)" : ""
                }`}
                onClick={() => goToExercise(i)}
                className={`grid h-11 min-w-11 shrink-0 place-items-center rounded-xl border px-2 text-sm font-semibold tabular-nums transition-colors ${
                  st === "done"
                    ? "border-accent bg-accent text-black"
                    : st === "partial"
                      ? "border-accent text-accent"
                      : "bg-surface-2 text-muted"
                } ${current ? "ring-2 ring-foreground ring-offset-2 ring-offset-base" : ""}`}
              >
                {st === "done" ? "✓" : i + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="card space-y-4">
        {ex.imageUrl && (
          // Feste Höhe: das Bild lädt sonst nach und schiebt die Satz-Zeilen
          // unter dem Finger weg.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ex.imageUrl}
            alt={`So geht ${ex.name}`}
            decoding="async"
            className="h-44 w-full rounded-xl border bg-white object-contain"
          />
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold">{ex.name}</h2>
            {ex.isCardio ? (
              <p className="text-foreground">
                Ziel: {ex.sets > 1 ? `${ex.sets} × ` : ""}
                {ex.targetReps ?? "–"} min
              </p>
            ) : (
              <p className="text-foreground">
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
          <button
            type="button"
            className="btn-ghost relative shrink-0 px-3"
            onClick={() => openNote(ex.exerciseId)}
            aria-label={
              hasNote ? `Notiz zu ${ex.name} öffnen` : `Notiz zu ${ex.name} anlegen`
            }
          >
            📝 Notiz
            {(hasNote || hasDraft) && (
              <span
                className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-surface ${
                  hasDraft ? "bg-warn" : "bg-accent"
                }`}
              />
            )}
          </button>
        </div>

        {/* Satz-Zeilen */}
        <div className="space-y-2">
          <div
            className={`grid ${gridCols} gap-2 px-1 text-sm text-muted`}
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
            const durMin = parseNum(v.durationMin);
            return (
              <div
                key={s}
                className={`grid ${gridCols} items-center gap-2 rounded-xl transition-opacity ${
                  v.done ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  aria-label={`Satz ${s} für ±-Buttons wählen`}
                  onClick={() => setActiveSetNo(s)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold ${
                    v.done ? "bg-accent-soft text-accent" : "bg-surface-2"
                  } ${s === activeSet ? "ring-2 ring-accent" : ""}`}
                >
                  {s}
                </button>
                {ex.isCardio ? (
                  isRunningHere ? (
                    <div className="col-span-3 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted">Läuft…</span>
                          <span className="text-xl font-black tabular-nums text-accent">
                            {fmt(timerRemainingSec)}
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
                        className="btn-ghost shrink-0 px-3 text-sm"
                        onClick={stopCardioTimer}
                      >
                        Beenden
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Satz ${s} Minuten`}
                        className="input"
                        value={v.durationMin}
                        onFocus={(e) => {
                          e.target.select();
                          setActiveSetNo(s);
                        }}
                        onChange={(e) =>
                          setLog(ex.planExerciseId, s, "durationMin", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="btn-primary px-4 text-sm"
                        disabled={timer != null || durMin == null || durMin <= 0}
                        onClick={() =>
                          startCardioTimer(ex.planExerciseId, s, durMin ?? 0)
                        }
                      >
                        ▶ Start
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Satz ${s} Gewicht in kg`}
                      className="input"
                      value={v.weight}
                      onFocus={(e) => {
                        e.target.select();
                        setActiveSetNo(s);
                      }}
                      onChange={(e) =>
                        setLog(ex.planExerciseId, s, "weight", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`Satz ${s} Wiederholungen`}
                      className="input"
                      value={v.reps}
                      onFocus={(e) => {
                        e.target.select();
                        setActiveSetNo(s);
                      }}
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
                    onClick={() => toggleDone(ex, s)}
                    className={`grid h-12 w-12 place-items-center rounded-xl border text-xl transition-colors ${
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

        {/* ±-Buttons für den aktiven Satz — schneller als Tastatur */}
        {!(ex.isCardio && timer?.peId === ex.planExerciseId) && (
          <div className="card-2 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">
              Satz {activeSet} anpassen
            </div>
            {ex.isCardio ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-ghost" onClick={() => bump(ex, activeSet, "durationMin", -1)}>
                  −1 min
                </button>
                <button className="btn-ghost" onClick={() => bump(ex, activeSet, "durationMin", 1)}>
                  +1 min
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <button
                  className="btn-ghost px-1"
                  aria-label={`Satz ${activeSet}: Gewicht minus ${WEIGHT_STEP} kg`}
                  onClick={() => bump(ex, activeSet, "weight", -WEIGHT_STEP)}
                >
                  −{WEIGHT_STEP.toLocaleString("de-DE")}
                </button>
                <button
                  className="btn-ghost px-1"
                  aria-label={`Satz ${activeSet}: Gewicht plus ${WEIGHT_STEP} kg`}
                  onClick={() => bump(ex, activeSet, "weight", WEIGHT_STEP)}
                >
                  +{WEIGHT_STEP.toLocaleString("de-DE")}
                </button>
                <button
                  className="btn-ghost px-1"
                  aria-label={`Satz ${activeSet}: eine Wiederholung weniger`}
                  onClick={() => bump(ex, activeSet, "reps", -1)}
                >
                  −1
                </button>
                <button
                  className="btn-ghost px-1"
                  aria-label={`Satz ${activeSet}: eine Wiederholung mehr`}
                  onClick={() => bump(ex, activeSet, "reps", 1)}
                >
                  +1
                </button>
                <span className="col-span-2 text-center text-xs text-muted">kg</span>
                <span className="col-span-2 text-center text-xs text-muted">Wdh.</span>
              </div>
            )}
          </div>
        )}

        {/* Pausen-Presets: Tippen startet sofort und merkt sich die Dauer für
            den Auto-Start beim nächsten Abhaken. */}
        {!ex.isCardio && (
          <div className="card-2">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted">
              Pause · startet beim Abhaken automatisch
            </div>
            <div className="grid grid-cols-3 gap-2">
              {REST_PRESETS.map((sec) => (
                <button
                  key={sec}
                  className={`btn-ghost ${restPreset === sec ? "pill-active" : ""}`}
                  onClick={() => startRest(sec)}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation — klebt am unteren Rand, mit Daumen immer erreichbar.
          sticky statt fixed: fixed springt unter iOS mit offener Tastatur mit.
          Laufende Pause steht hier, damit sie nie aus dem Blick scrollt. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-3 border-t bg-base/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {rest && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-muted">Pause</span>
                <span className="text-2xl font-black tabular-nums text-accent">
                  {fmt(restRemainingSec)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${restPct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-3 text-sm"
              onClick={() => setRest(null)}
            >
              Überspringen
            </button>
          </div>
        )}
        {!rest && restDoneFlash && (
          <div className="mb-2 animate-pop-in rounded-xl bg-accent px-3 py-2.5 text-center font-bold text-black">
            Pause vorbei — nächster Satz! 💪
          </div>
        )}
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1 py-3"
            onClick={() => goToExercise(exIdx - 1)}
            disabled={exIdx === 0}
          >
            ← Zurück
          </button>
          {isLast ? (
            <button className="btn-primary flex-1 py-3" onClick={requestFinish}>
              Training abschließen
            </button>
          ) : (
            <button
              className="btn-primary flex-1 py-3"
              onClick={() => goToExercise(exIdx + 1)}
            >
              Nächste Übung →
            </button>
          )}
        </div>
      </div>

      {/* Notiz-Dialog — oben verankert, damit die Bildschirmtastatur ihn nicht
          verdeckt. Inhalt ist nur hier sichtbar. */}
      {noteOpenFor && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-title"
        >
          <div className="card w-full max-w-md space-y-3 animate-pop-in">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted">Notiz</div>
              <h3 id="note-title" className="text-lg font-semibold">
                {exercises.find((e) => e.exerciseId === noteOpenFor)?.name}
              </h3>
              {notes[noteOpenFor] && (
                <p className="text-xs text-muted">
                  Zuletzt geändert{" "}
                  {new Date(notes[noteOpenFor].updatedAt).toLocaleDateString("de-DE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <textarea
              className="input min-h-36 resize-none leading-relaxed"
              rows={6}
              autoFocus
              maxLength={NOTE_MAX_LEN}
              placeholder="z.B. Sitz Stufe 4, Griff eng, linke Schulter beobachten…"
              value={noteText(noteOpenFor)}
              onChange={(e) => editNote(noteOpenFor, e.target.value)}
            />
            <p className="text-xs text-muted">
              Gilt für diese Übung in allen deinen Trainings. Leer speichern löscht
              die Notiz.
            </p>
            {noteStatus === "error" && (
              <p className="text-sm text-danger">
                Nicht gespeichert — bitte Verbindung prüfen. Dein Text bleibt erhalten.
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1"
                onClick={closeNote}
                disabled={noteStatus === "saving"}
              >
                Schließen
              </button>
              <button
                className="btn-primary flex-1"
                onClick={saveNote}
                disabled={noteStatus === "saving"}
              >
                {noteStatus === "saving" ? "Speichert…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offene Sätze beim Abschließen */}
      {confirmOpenSets > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-safe backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-4 text-center">
            <h3 className="text-lg font-semibold">
              {confirmOpenSets === 1
                ? "1 Satz ist nicht abgehakt"
                : `${confirmOpenSets} Sätze sind nicht abgehakt`}
            </h3>
            <p className="text-sm text-muted">
              Sollen die vorausgefüllten Werte trotzdem gespeichert werden?
            </p>
            <div className="space-y-2">
              <button
                className="btn-primary w-full"
                onClick={() => goToExertion(true)}
              >
                Nur abgehakte speichern
              </button>
              <button
                className="btn-ghost w-full"
                onClick={() => goToExertion(false)}
              >
                Alle Sätze speichern
              </button>
              <button
                className="btn-ghost w-full"
                onClick={() => setConfirmOpenSets(0)}
              >
                Zurück zum Training
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abbrechen-Bestätigung */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-safe backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-4 text-center">
            <h3 className="text-lg font-semibold">Training wirklich abbrechen?</h3>
            <p className="text-sm text-muted">
              Dein bisheriger Fortschritt wird nicht als abgeschlossen gewertet.
              Notizen bleiben erhalten.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1"
                onClick={() => setConfirmCancel(false)}
              >
                Zurück zum Training
              </button>
              <button className="btn-danger flex-1" onClick={doCancel}>
                Training verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </FlowShell>
  );
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
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

// --- Signal bei Timer-Ablauf ---------------------------------------------
// iOS spielt Web-Audio nur aus einem AudioContext, der in einer Nutzer-Geste
// erzeugt/fortgesetzt wurde — der Ablauf passiert aber in einem Timer. Daher
// einen geteilten Context bei jedem Tap (Abhaken, Preset, Start) entsperren.
let sharedAudio: AudioContext | null = null;

function unlockAudio() {
  try {
    if (!sharedAudio) {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      sharedAudio = new Ctx();
    }
    if (sharedAudio.state === "suspended") sharedAudio.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}

function notifyDone() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 80, 200]);
    }
    unlockAudio();
    const ctx = sharedAudio;
    if (!ctx) return;
    // Zwei kurze Töne
    for (const offset of [0, 0.45]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    }
  } catch {
    /* ignore */
  }
}
