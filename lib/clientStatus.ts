// Ampel-Logik + Cross-Plan-Statistik für die Trainer-Kundenübersicht.
import { prisma } from "@/lib/prisma";
import { localDateKey, startOfWeek } from "@/lib/schedule";

export type Tone = "text-danger" | "text-warn" | "text-accent" | "text-muted";

// Wie lange her ist das letzte Training? >14d/nie = danger, >7d = warn, sonst accent.
// Gerechnet wird in Kalendertagen, nicht in 24h-Fenstern — ein Training gestern
// Abend zählt heute Früh als "Gestern trainiert", nicht als "Heute trainiert".
export function activityStatus(last: Date | null, now = new Date()) {
  if (!last) {
    return { label: "Noch kein Training", tone: "text-danger" as Tone, days: null as number | null };
  }
  const days = Math.round(
    (localDateKey(now).getTime() - localDateKey(last).getTime()) / 86400000,
  );
  const label =
    days === 0 ? "Heute trainiert" : days === 1 ? "Gestern trainiert" : `Vor ${days} Tagen trainiert`;
  const tone: Tone = days > 14 ? "text-danger" : days > 7 ? "text-warn" : "text-accent";
  return { label, tone, days };
}

// Soll-Frequenz dieser Woche. "Noch erreichbar" ist bewusst neutral (muted),
// nicht warn — nur "rechnerisch nicht mehr erreichbar" wird als danger markiert.
export function frequencyStatus(goal: number, completedThisWeek: number, now = new Date()) {
  const weekStart = startOfWeek(now);
  const today = localDateKey(now);
  const dow = Math.round((today.getTime() - weekStart.getTime()) / 86400000); // 0=Mo…6=So
  const daysLeftInclusive = 7 - dow; // heute zählt noch als verfügbarer Tag
  const remaining = Math.max(0, goal - completedThisWeek);
  const base = `${completedThisWeek}/${goal} diese Woche`;
  if (remaining === 0) return { label: base, tone: "text-accent" as Tone };
  if (remaining <= daysLeftInclusive) return { label: base, tone: "text-muted" as Tone };
  return { label: `${base} – nicht mehr erreichbar`, tone: "text-danger" as Tone };
}

// Stimmt die Standardwoche noch mit der zuletzt geänderten Verfügbarkeit
// überein? null = nichts Auffälliges zu zeigen.
export function weekSyncStatus(
  pref: { updatedAt: Date } | null,
  standardWeek: { updatedAt: Date } | null,
): { label: string; tone: Tone } | null {
  if (!pref) return null;
  if (!standardWeek) return { label: "Noch nicht zugeteilt", tone: "text-warn" };
  if (pref.updatedAt > standardWeek.updatedAt) {
    return { label: "Verfügbarkeit geändert", tone: "text-warn" };
  }
  return null;
}

export type ClientSessionPoint = {
  id: string;
  date: string; // ISO
  planName: string;
  motivation: number | null;
  exertion: number | null;
  totalVolume: number;
  totalSets: number;
};

export type ClientTrainingStats = {
  count: number;
  avgMotivation: number;
  avgExertion: number;
  totalVolume: number;
  sessions: ClientSessionPoint[]; // aufsteigend nach Datum, für Charts
};

function avg(arr: (number | null)[]) {
  const v = arr.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0;
}

// Trainingsstatistik über alle Pläne eines Kunden hinweg (getHistory in
// app/t/[shareToken]/actions.ts ist pro Plan). Join über clientName, gleiche
// Konvention wie im Rest der App. Volumen: nur wenn weight UND reps gesetzt
// (Cardio-Sätze bleiben außen vor).
export async function getClientTrainingStats(clientName: string): Promise<ClientTrainingStats> {
  const sessions = await prisma.workoutSession.findMany({
    where: { clientName, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    include: {
      plan: { select: { name: true } },
      setLogs: { select: { weight: true, reps: true } },
    },
  });
  const points: ClientSessionPoint[] = sessions.map((s) => {
    let totalVolume = 0;
    for (const l of s.setLogs) {
      if (l.weight != null && l.reps != null) totalVolume += l.weight * l.reps;
    }
    return {
      id: s.id,
      date: s.startedAt.toISOString(),
      planName: s.plan.name,
      motivation: s.motivation,
      exertion: s.exertion,
      totalVolume: Math.round(totalVolume),
      totalSets: s.setLogs.length,
    };
  });
  return {
    count: points.length,
    avgMotivation: avg(points.map((p) => p.motivation)),
    avgExertion: avg(points.map((p) => p.exertion)),
    totalVolume: points.reduce((a, p) => a + p.totalVolume, 0),
    sessions: points,
  };
}
