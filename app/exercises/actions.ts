"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fetchAndStoreImage, isHttpUrl } from "@/lib/serverImages";
import { requireTrainer } from "@/lib/auth";

// Lädt eine externe Bild-URL herunter und gibt den lokalen Pfad zurück.
export async function importImage(url: string) {
  await requireTrainer();
  try {
    const local = await fetchAndStoreImage(url);
    return { ok: true as const, url: local };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Import fehlgeschlagen",
    };
  }
}

// Externe URL beim Speichern automatisch lokal re-hosten (Fallback: Original behalten).
async function normalizeImageUrl(imageUrl?: string | null): Promise<string | null> {
  const val = (imageUrl || "").trim();
  if (!val) return null;
  if (val.startsWith("/exercise-images/")) return val; // schon lokal
  if (isHttpUrl(val)) {
    try {
      return await fetchAndStoreImage(val);
    } catch {
      return val; // im Zweifel Original-Link behalten, damit nichts verloren geht
    }
  }
  return val;
}

export type ExercisePayload = {
  id?: string;
  name: string;
  equipment: string;
  category?: string;
  imageUrl?: string | null;
  muscles: { muscleId: string; percentage: number }[];
};

export async function saveExercise(payload: ExercisePayload) {
  await requireTrainer();
  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Name fehlt" };

  const muscles = payload.muscles.filter((m) => m.percentage > 0);
  const imageUrl = await normalizeImageUrl(payload.imageUrl);

  if (payload.id) {
    await prisma.exercise.update({
      where: { id: payload.id },
      data: {
        name,
        equipment: payload.equipment,
        category: payload.category || null,
        imageUrl,
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
        imageUrl,
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
  await requireTrainer();
  await prisma.exercise.delete({ where: { id } });
  revalidatePath("/exercises");
  return { ok: true };
}
