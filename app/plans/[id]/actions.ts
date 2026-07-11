"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type PlanExerciseDTO = {
  id: string;
  exerciseId: string;
  name: string;
  equipment: string;
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
  const count = await prisma.planExercise.count({ where: { planId } });
  const created = await prisma.planExercise.create({
    data: { planId, exerciseId, order: count },
  });
  revalidatePath(`/plans/${planId}`);
  return toDTO(created.id);
}

export async function updatePlanExercise(
  id: string,
  fields: { sets?: number; targetReps?: number | null; targetWeight?: number | null },
) {
  await prisma.planExercise.update({
    where: { id },
    data: {
      sets: fields.sets,
      targetReps: fields.targetReps,
      targetWeight: fields.targetWeight,
    },
  });
  return { ok: true };
}

export async function removePlanExercise(id: string) {
  await prisma.planExercise.delete({ where: { id } });
  return { ok: true };
}

export async function renamePlan(id: string, name: string) {
  await prisma.plan.update({ where: { id }, data: { name: name.trim() || "Plan" } });
  revalidatePath(`/plans/${id}`);
  return { ok: true };
}
