// Effektive Trainingswoche eines Kunden: eine Wochen-Ausnahme (WeeklySchedule)
// ersetzt die Standardwoche komplett; sonst gilt die Standardwoche; sonst ist
// noch nichts zugeteilt.
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/schedule";

export type WeekEntry = {
  key: string; // stabiler Render-Key (Entry-Id bzw. Komposit bei Standardwoche)
  weekday: number; // 0=Mo … 6=So
  date: Date; // Kalendertag innerhalb der Woche (UTC-Mitternacht, lokal)
  position: number;
  planId: string;
  plan: { name: string; shareToken: string };
};

export type EffectiveWeek = {
  source: "OVERRIDE" | "STANDARD" | "NONE";
  entries: WeekEntry[];
};

export async function getEffectiveWeek(
  accountId: string,
  weekStart: Date,
): Promise<EffectiveWeek> {
  const override = await prisma.weeklySchedule.findUnique({
    where: { accountId_weekStart: { accountId, weekStart } },
    include: {
      entries: {
        include: { plan: { select: { name: true, shareToken: true } } },
        orderBy: [{ date: "asc" }, { position: "asc" }],
      },
    },
  });
  if (override) {
    return {
      source: "OVERRIDE",
      entries: override.entries.map((e) => ({
        key: e.id,
        weekday: Math.round(
          (e.date.getTime() - weekStart.getTime()) / 86400000,
        ),
        date: e.date,
        position: e.position,
        planId: e.planId,
        plan: e.plan,
      })),
    };
  }

  const standard = await prisma.standardWeek.findUnique({
    where: { accountId },
    include: {
      entries: {
        include: { plan: { select: { name: true, shareToken: true } } },
        orderBy: [{ weekday: "asc" }, { position: "asc" }],
      },
    },
  });
  if (standard) {
    return {
      source: "STANDARD",
      entries: standard.entries.map((e) => ({
        key: e.id,
        weekday: e.weekday,
        date: addDays(weekStart, e.weekday),
        position: e.position,
        planId: e.planId,
        plan: e.plan,
      })),
    };
  }

  return { source: "NONE", entries: [] };
}
