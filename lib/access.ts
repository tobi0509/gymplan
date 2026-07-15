// Zentrale Zugriffsprüfung für Pläne (direkt zugewiesen oder via Programm).
import { prisma } from "@/lib/prisma";
import { ROLE } from "@/lib/auth";
import type { Account, Plan } from "@prisma/client";

// Trainer: immer. Kunde: eigener Plan, vom Trainer eingeplanter Plan
// (Standardwoche oder Wochen-Ausnahme), Plan in einem eigenen (oder
// unzugewiesenen) Programm, oder "freier" Plan ohne Zuweisung und ohne
// Programm-Zugehörigkeit (Legacy-Share-Link).
export async function mayAccessPlan(
  account: Account,
  plan: Pick<Plan, "id" | "assignedToId">,
): Promise<boolean> {
  if (account.role !== ROLE.CLIENT) return true;
  if (plan.assignedToId === account.id) return true;

  // Eingeplant → Zugriff, auch wenn der Plan einem anderen Kunden direkt
  // zugewiesen ist (der Trainer darf jeden Plan einplanen).
  const [standard, scheduled] = await Promise.all([
    prisma.standardWeekEntry.count({
      where: { planId: plan.id, week: { accountId: account.id } },
    }),
    prisma.scheduleEntry.count({
      where: { planId: plan.id, schedule: { accountId: account.id } },
    }),
  ]);
  if (standard > 0 || scheduled > 0) return true;

  const days = await prisma.programDay.findMany({
    where: { planId: plan.id },
    select: { program: { select: { assignedToId: true } } },
  });
  // Plan gehört zu einem Programm des Kunden → Zugriff, auch wenn der Plan
  // (zusätzlich) einem anderen Kunden direkt zugewiesen ist — sonst verliert
  // der Programm-Kunde den Zugriff auf seine eigene Trainingshistorie.
  if (days.some((d) => d.program.assignedToId === account.id)) return true;

  if (plan.assignedToId != null) return false;

  if (days.length === 0) return true; // in keinem Programm → offener Share-Link
  return days.some((d) => d.program.assignedToId == null);
}
