"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireTrainer } from "@/lib/auth";

export type PlanExerciseDTO = {
  id: string;
  exerciseId: string;
  name: string;
  equipment: string;
  category: string | null;
  order: number;
  sets: number;
  targetReps: number | null;
  targetWeight: number | null;
  contributions: { muscleId: string; percentage: number }[];
};

async function toDTO(planExerciseId: string): Promise<PlanExerciseDTO> {
  const pe = await prisma.planExercise.findUniqueOrThrow({
    where: { id: planExerciseId },
    include: { exercise: { include: { muscles: true } } },
  });
  return {
    id: pe.id,
    exerciseId: pe.exerciseId,
    name: pe.exercise.name,
    equipment: pe.exercise.equipment,
    category: pe.exercise.category,
    order: pe.order,
    sets: pe.sets,
    targetReps: pe.targetReps,
    targetWeight: pe.targetWeight,
    contributions: pe.exercise.muscles.map((m) => ({
      muscleId: m.muscleId,
      percentage: m.percentage,
    })),
  };
}

export async function addExerciseToPlan(planId: string, exerciseId: string) {
  await requireTrainer();
  // max(order)+1 statt count: nach Löschungen erzeugt count Duplikate,
  // und die Übungsreihenfolge des Kunden wäre nicht mehr stabil.
  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.planExercise.aggregate({
      where: { planId },
      _max: { order: true },
    });
    return tx.planExercise.create({
      data: { planId, exerciseId, order: (max._max.order ?? -1) + 1 },
    });
  });
  revalidatePath(`/plans/${planId}`);
  return toDTO(created.id);
}

export async function updatePlanExercise(
  id: string,
  fields: { sets?: number; targetReps?: number | null; targetWeight?: number | null },
) {
  await requireTrainer();
  // sets/targetReps sind Int-Spalten — Dezimalwerte aus dem number-Input
  // würden Prisma werfen lassen; 0/negative Sätze machen die Übung
  // unloggbar. Deshalb hier runden und clampen.
  await prisma.planExercise.update({
    where: { id },
    data: {
      sets: fields.sets != null ? Math.max(1, Math.round(fields.sets)) : undefined,
      targetReps:
        fields.targetReps != null
          ? Math.max(1, Math.round(fields.targetReps))
          : fields.targetReps,
      targetWeight:
        fields.targetWeight != null
          ? Math.max(0, fields.targetWeight)
          : fields.targetWeight,
    },
  });
  return { ok: true };
}

export async function removePlanExercise(id: string) {
  await requireTrainer();
  // Nach dem Löschen lückenlos neu nummerieren (heilt auch Alt-Duplikate)
  await prisma.$transaction(async (tx) => {
    const removed = await tx.planExercise.delete({ where: { id } });
    const rest = await tx.planExercise.findMany({
      where: { planId: removed.planId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < rest.length; i++) {
      await tx.planExercise.update({
        where: { id: rest[i].id },
        data: { order: i },
      });
    }
  });
  return { ok: true };
}

export async function renamePlan(id: string, name: string) {
  await requireTrainer();
  await prisma.plan.update({ where: { id }, data: { name: name.trim() || "Plan" } });
  revalidatePath(`/plans/${id}`);
  return { ok: true };
}
