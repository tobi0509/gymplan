"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ExercisePayload = {
  id?: string;
  name: string;
  equipment: string;
  category?: string;
  muscles: { muscleId: string; percentage: number }[];
};

export async function saveExercise(payload: ExercisePayload) {
  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Name fehlt" };

  const muscles = payload.muscles.filter((m) => m.percentage > 0);

  if (payload.id) {
    await prisma.exercise.update({
      where: { id: payload.id },
      data: {
        name,
        equipment: payload.equipment,
        category: payload.category || null,
      },
    });
    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: payload.id } });
    if (muscles.length) {
      await prisma.exerciseMuscle.createMany({
        data: muscles.map((m) => ({
          exerciseId: payload.id!,
          muscleId: m.muscleId,
          percentage: Math.round(m.percentage),
        })),
      });
    }
  } else {
    await prisma.exercise.create({
      data: {
        name,
        equipment: payload.equipment,
        category: payload.category || null,
        muscles: {
          create: muscles.map((m) => ({
            muscleId: m.muscleId,
            percentage: Math.round(m.percentage),
          })),
        },
      },
    });
  }

  revalidatePath("/exercises");
  return { ok: true };
}

export async function deleteExercise(id: string) {
  await prisma.exercise.delete({ where: { id } });
  revalidatePath("/exercises");
  return { ok: true };
}
