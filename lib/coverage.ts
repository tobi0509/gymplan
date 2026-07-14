// Muskel-Abdeckung für einen Wochen-Trainingsplan.
// Reine Funktion – auf Server & Client nutzbar (keine Prisma-Abhängigkeit).
//
// Regel des Trainers: 100 % = ein Muskel wird 2× pro Woche voll trainiert.
// Wir rechnen in "Session-Äquivalenten":
//   - Eine Übung, die einen Muskel zu 100 % trifft und mit SET_BASELINE Sätzen
//     ausgeführt wird, zählt als 1.0 Session für diesen Muskel.
//   - Mehr/weniger Sätze skalieren linear (sets / SET_BASELINE).
//   - TARGET_SESSIONS (=2) Session-Äquivalente ergeben 100 %.
//
// Beide Konstanten sind bewusst hier oben, damit der Trainer sie justieren kann.
export const SET_BASELINE = 3; // Sätze, die als "eine volle Session" gelten
export const TARGET_SESSIONS = 2; // Ziel pro Woche = 100 %

export type MuscleContribution = { muscleId: string; percentage: number };

export type PlanExerciseInput = {
  exerciseName: string;
  sets: number;
  contributions: MuscleContribution[];
};

export type MuscleCoverage = {
  muscleId: string;
  sessionScore: number; // Session-Äquivalente
  coveragePct: number; // 0–100 (gedeckelt)
  bucket: 0 | 1 | 2 | 3; // 0 = keine, 1 = <50 %, 2 = 50–99 %, 3 = 100 %
  contributors: { exerciseName: string; percentage: number }[];
};

// targetSessions: Session-Äquivalente, die 100 % ergeben. Default = Wochenziel
// eines einzelnen Plans; für Programme mit mehreren Tagen entsprechend skalieren
// (z.B. TARGET_SESSIONS × Anzahl Tage), sonst steht schnell alles auf 100 %.
export function computeCoverage(
  planExercises: PlanExerciseInput[],
  targetSessions: number = TARGET_SESSIONS,
): Record<string, MuscleCoverage> {
  const out: Record<string, MuscleCoverage> = {};

  for (const pe of planExercises) {
    const setFactor = (pe.sets || 0) / SET_BASELINE;
    for (const c of pe.contributions) {
      const contribution = (c.percentage / 100) * setFactor;
      const entry =
        out[c.muscleId] ??
        (out[c.muscleId] = {
          muscleId: c.muscleId,
          sessionScore: 0,
          coveragePct: 0,
          bucket: 0,
          contributors: [],
        });
      entry.sessionScore += contribution;
      entry.contributors.push({
        exerciseName: pe.exerciseName,
        percentage: c.percentage,
      });
    }
  }

  for (const entry of Object.values(out)) {
    entry.coveragePct = Math.min(
      100,
      (entry.sessionScore / targetSessions) * 100,
    );
    entry.bucket = bucketFor(entry.coveragePct);
  }

  return out;
}

export function bucketFor(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= 100) return 3;
  if (pct >= 50) return 2;
  if (pct > 0) return 1;
  return 0;
}
