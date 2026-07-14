"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { addDays, startOfWeek } from "@/lib/schedule";

// Formularfelder: accountId, day-0 … day-6 (planId oder "" = frei),
// bei Wochen-Ausnahmen zusätzlich weekStart (ISO) und woche (Tab-Slug).

async function requireClientAccount(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.role !== ROLE.CLIENT) {
    throw new Error("Unbekannter Kunde");
  }
  return account;
}

// Liest day-0..day-6 aus und validiert die Plan-IDs gegen die DB.
async function readDayEntries(formData: FormData) {
  const planIds = new Set(
    (await prisma.plan.findMany({ select: { id: true } })).map((p) => p.id),
  );
  const entries: { weekday: number; planId: string }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const value = String(formData.get(`day-${weekday}`) || "");
    if (value && planIds.has(value)) entries.push({ weekday, planId: value });
  }
  return entries;
}

function parseWeekStart(formData: FormData): Date {
  const raw = String(formData.get("weekStart") || "");
  const parsed = new Date(raw);
  if (
    isNaN(parsed.getTime()) ||
    startOfWeek(parsed).getTime() !== parsed.getTime()
  ) {
    throw new Error("Ungültiger Wochenstart");
  }
  return parsed;
}

export async function saveStandardWeek(formData: FormData) {
  await requireTrainer();
  const accountId = String(formData.get("accountId") || "");
  await requireClientAccount(accountId);
  const entries = await readDayEntries(formData);

  await prisma.$transaction(async (tx) => {
    const week = await tx.standardWeek.upsert({
      where: { accountId },
      // updatedAt explizit setzen, damit auch ein unverändertes Speichern
      // den "Verfügbarkeit geändert"-Hinweis zurücksetzt.
      update: { updatedAt: new Date() },
      create: { accountId },
    });
    await tx.standardWeekEntry.deleteMany({ where: { weekId: week.id } });
    if (entries.length) {
      await tx.standardWeekEntry.createMany({
        data: entries.map((e) => ({
          weekId: week.id,
          planId: e.planId,
          weekday: e.weekday,
          position: 0,
        })),
      });
    }
  });

  revalidatePath("/clients");
  revalidatePath("/me");
  redirect(`/clients/${accountId}/week?gespeichert=1`);
}

export async function saveWeekOverride(formData: FormData) {
  await requireTrainer();
  const accountId = String(formData.get("accountId") || "");
  await requireClientAccount(accountId);
  const weekStart = parseWeekStart(formData);
  const woche = String(formData.get("woche") || "diese");
  const entries = await readDayEntries(formData);

  // Auch eine leere Abgabe legt die Ausnahme an (= trainingsfreie Woche).
  await prisma.$transaction(async (tx) => {
    const schedule = await tx.weeklySchedule.upsert({
      where: { accountId_weekStart: { accountId, weekStart } },
      update: {},
      create: { accountId, weekStart },
    });
    await tx.scheduleEntry.deleteMany({ where: { scheduleId: schedule.id } });
    if (entries.length) {
      await tx.scheduleEntry.createMany({
        data: entries.map((e) => ({
          scheduleId: schedule.id,
          planId: e.planId,
          date: addDays(weekStart, e.weekday),
          position: 0,
        })),
      });
    }
  });

  revalidatePath("/clients");
  revalidatePath("/me");
  redirect(`/clients/${accountId}/week?woche=${woche}&gespeichert=1`);
}

export async function clearWeekOverride(formData: FormData) {
  await requireTrainer();
  const accountId = String(formData.get("accountId") || "");
  await requireClientAccount(accountId);
  const weekStart = parseWeekStart(formData);
  const woche = String(formData.get("woche") || "diese");

  await prisma.weeklySchedule.deleteMany({
    where: { accountId, weekStart },
  });

  revalidatePath("/clients");
  revalidatePath("/me");
  redirect(`/clients/${accountId}/week?woche=${woche}`);
}
