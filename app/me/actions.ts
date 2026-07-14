"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import {
  getTargetWeekStart,
  localDateKey,
  addDays,
  distributeUnits,
} from "@/lib/schedule";

// Verteilt die Einheiten des Kunden auf seine gewählten Wochentage und
// speichert das Ergebnis als WeeklySchedule (überschreibt eine bestehende
// Planung derselben Woche).
export async function saveWeeklySchedule(formData: FormData) {
  const account = await requireAccount();
  if (account.role !== ROLE.CLIENT) redirect("/");

  // Zielwoche serverseitig bestimmen (sonntags: nächste Woche)
  const now = new Date();
  const weekStart = getTargetWeekStart(now);
  const today = localDateKey(now);

  // Gewählte Tage: Offsets 0..6 relativ zum Wochenstart, nur heute oder später
  const offsets = formData
    .getAll("day")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const dates = Array.from(new Set(offsets))
    .map((n) => addDays(weekStart, n))
    .filter((d) => d.getTime() >= today.getTime());

  // Einheiten: Tage des neuesten zugewiesenen Programms; Fallback: einzeln
  // zugewiesene Pläne in Zuweisungsreihenfolge.
  const program = await prisma.program.findFirst({
    where: { assignedToId: account.id },
    orderBy: { createdAt: "desc" },
    include: { days: { orderBy: { order: "asc" } } },
  });
  let units: string[];
  if (program && program.days.length > 0) {
    units = program.days.map((d) => d.planId);
  } else {
    const plans = await prisma.plan.findMany({
      where: { assignedToId: account.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    units = plans.map((p) => p.id);
  }

  if (units.length === 0) redirect("/me");
  if (dates.length === 0) redirect("/me?plan=1&err=days");

  const entries = distributeUnits(units, dates);

  await prisma.$transaction(async (tx) => {
    const schedule = await tx.weeklySchedule.upsert({
      where: { accountId_weekStart: { accountId: account.id, weekStart } },
      update: {},
      create: { accountId: account.id, weekStart },
    });
    await tx.scheduleEntry.deleteMany({ where: { scheduleId: schedule.id } });
    await tx.scheduleEntry.createMany({
      data: entries.map((e) => ({
        scheduleId: schedule.id,
        planId: e.planId,
        date: e.date,
        position: e.position,
      })),
    });
  });

  revalidatePath("/me");
  redirect("/me");
}
