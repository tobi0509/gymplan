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
  pickProgram,
} from "@/lib/schedule";

// Der Kunde gibt seine verfügbaren Tage an (Anzahl = gewünschte Frequenz).
// Das Programm mit passender Einheiten-Zahl wird automatisch gewählt
// (eigenes Programm vor Vorlagen); der Trainer kann es pro Woche übersteuern.
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

  // Wochenprogramm passend zur Frequenz wählen
  const candidates = await prisma.program.findMany({
    where: { OR: [{ assignedToId: null }, { assignedToId: account.id }] },
    include: { _count: { select: { days: true } } },
  });
  const picked = pickProgram(
    candidates.map((c) => ({
      id: c.id,
      assignedToId: c.assignedToId,
      createdAt: c.createdAt,
      unitCount: c._count.days,
    })),
    dates.length,
    account.id,
  );

  let units: string[] = [];
  let programId: string | null = null;
  if (picked) {
    const days = await prisma.programDay.findMany({
      where: { programId: picked.id },
      orderBy: { order: "asc" },
      select: { planId: true },
    });
    units = days.map((d) => d.planId);
    programId = picked.id;
  } else {
    // Fallback ohne jedes Programm: einzeln zugewiesene Pläne
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
      update: {
        programId,
        programSource: "AUTO",
        selectedDays: JSON.stringify(dates.map((d) => d.toISOString())),
      },
      create: {
        accountId: account.id,
        weekStart,
        programId,
        programSource: "AUTO",
        selectedDays: JSON.stringify(dates.map((d) => d.toISOString())),
      },
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
