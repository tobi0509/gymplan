// Pure Datums-Logik für die Wochenplanung (kein Prisma).
//
// Datums-Konvention: Kalendertage werden als "UTC-Mitternacht des lokalen
// Datums" gespeichert und verglichen (localDateKey). Dadurch sind Vergleiche
// exakte Gleichheit auf dem Unique-Key – keine DST-Effekte, solange nie mit
// Stunden gerechnet wird. Serverseitig muss TZ korrekt gesetzt sein.

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

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

// Wochentags-Array (0=Mo … 6=So) aus dem JSON-String einer
// TrainingPreference – defensiv geparst.
export function parseWeekdays(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return Array.from(
      new Set(
        arr
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      ),
    ).sort((a, b) => a - b);
  } catch {
    return [];
  }
}
