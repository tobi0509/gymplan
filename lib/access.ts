// Zentrale Zugriffsprüfung für Pläne (direkt zugewiesen oder via Programm).
import { prisma } from "@/lib/prisma";
import { ROLE } from "@/lib/auth";
import type { Account, Plan } from "@prisma/client";

// Trainer: immer. Kunde: eigener Plan, Plan in einem eigenen (oder
// unzugewiesenen) Programm, oder "freier" Plan ohne Zuweisung und ohne
// Programm-Zugehörigkeit (Legacy-Share-Link).
export async function mayAccessPlan(
  account: Account,
  plan: Pick<Plan, "id" | "assignedToId">,
): Promise<boolean> {
  if (account.role !== ROLE.CLIENT) return true;
  if (plan.assignedToId === account.id) return true;
  if (plan.assignedToId != null) return false;

  const days = await prisma.programDay.findMany({
    where: { planId: plan.id },
    select: { program: { select: { assignedToId: true } } },
  });
  if (days.length === 0) return true; // in keinem Programm → offener Share-Link
  return days.some(
    (d) => d.program.assignedToId === account.id || d.program.assignedToId == null,
  );
}
