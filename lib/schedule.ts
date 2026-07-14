// Pure Datums- und Verteilungslogik für die Wochenplanung (kein Prisma).
//
// Datums-Konvention: Kalendertage werden als "UTC-Mitternacht des lokalen
// Datums" gespeichert und verglichen (localDateKey). Dadurch sind Vergleiche
// exakte Gleichheit auf dem Unique-Key – keine DST-Effekte, solange nie mit
// Stunden gerechnet wird. Serverseitig muss TZ korrekt gesetzt sein.

export function localDateKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function addDays(key: Date, n: number): Date {
  const out = new Date(key);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// Montag der Woche, in der d liegt (als localDateKey).
export function startOfWeek(d: Date): Date {
  const key = localDateKey(d);
  const weekday = (key.getUTCDay() + 6) % 7; // Mo=0 … So=6
  return addDays(key, -weekday);
}

// Zielwoche für die Planung: sonntags wird die nächste Woche geplant,
// sonst die aktuelle (Restwoche).
export function getTargetWeekStart(now: Date): Date {
  if (now.getDay() === 0) return addDays(startOfWeek(now), 7);
  return startOfWeek(now);
}

export type DistributedEntry = { date: Date; planId: string; position: number };

// Verteilt die Einheiten eines Zyklus auf die gewählten Tage (aufsteigend
// sortiert). Genug Tage → spreizen mit maximalen Ruhetagen dazwischen.
// Zu wenig Tage → Einheiten zusammenlegen (front-loaded), Zyklus-Reihenfolge
// bleibt immer erhalten.
export function distributeUnits(
  planIds: string[],
  dates: Date[],
): DistributedEntry[] {
  const N = planIds.length;
  const K = dates.length;
  if (N === 0 || K === 0) return [];
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  const out: DistributedEntry[] = [];
  if (K >= N) {
    // z.B. 3 Einheiten auf 5 Tage → Tag 0, 2, 4
    for (let i = 0; i < N; i++) {
      const idx = N === 1 ? 0 : Math.round((i * (K - 1)) / (N - 1));
      out.push({ date: sorted[idx], planId: planIds[i], position: 0 });
    }
  } else {
    // z.B. 3 Einheiten auf 2 Tage → [Tag1+Tag2, Tag3]
    const base = Math.floor(N / K);
    const extra = N % K;
    let cursor = 0;
    for (let j = 0; j < K; j++) {
      const count = base + (j < extra ? 1 : 0);
      for (let p = 0; p < count; p++) {
        out.push({ date: sorted[j], planId: planIds[cursor++], position: p });
      }
    }
  }
  return out;
}
