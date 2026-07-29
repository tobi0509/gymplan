"use server";

import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { getExerciseProgress, type ExerciseProgressPoint } from "@/lib/clientStatus";

// Trainer wählt eine Übung aus dem Dropdown; Fortschritt wird bei Bedarf
// nachgeladen (nicht Teil des initialen Seiten-Payloads).
export async function fetchExerciseProgress(
  accountId: string,
  exerciseId: string,
): Promise<ExerciseProgressPoint[]> {
  await requireTrainer();
  const client = await prisma.account.findUnique({ where: { id: accountId } });
  if (!client || client.role !== ROLE.CLIENT) return [];
  return getExerciseProgress(client.displayName, exerciseId);
}
