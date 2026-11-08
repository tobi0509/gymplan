import { prisma } from "@/lib/prisma";

// Plan "löschen": Hat er schon Trainings, wird er nur archiviert — sonst
// würden per Cascade alle Sessions/Sätze und damit Verlauf & Fortschritt
// des Kunden verschwinden. Ohne Trainings wird wirklich gelöscht.
export async function removePlan(id: string) {
  const sessions = await prisma.workoutSession.count({ where: { planId: id } });
  if (sessions > 0) {
    await prisma.plan.update({ where: { id }, data: { archivedAt: new Date() } });
  } else {
    await prisma.plan.delete({ where: { id } });
  }
}
