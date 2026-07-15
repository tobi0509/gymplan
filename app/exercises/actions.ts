"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fetchAndStoreImage, isHttpUrl } from "@/lib/serverImages";
import { requireTrainer } from "@/lib/auth";

function prismaErrorCode(e: unknown): string | null {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null;
}

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

  try {
    if (payload.id) {
      // Update + Muskel-Ersatz atomar: bricht es zwischen deleteMany und
      // createMany ab, wären sonst alle Muskel-Prozente der Übung weg.
      await prisma.$transaction([
        prisma.exercise.update({
          where: { id: payload.id },
          data: {
            name,
            equipment: payload.equipment,
            category: payload.category || null,
            imageUrl,
          },
        }),
        prisma.exerciseMuscle.deleteMany({ where: { exerciseId: payload.id } }),
        ...(muscles.length
          ? [
              prisma.exerciseMuscle.createMany({
                data: muscles.map((m) => ({
                  exerciseId: payload.id!,
                  muscleId: m.muscleId,
                  percentage: Math.round(m.percentage),
                })),
              }),
            ]
          : []),
      ]);
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
  } catch (e) {
    if (prismaErrorCode(e) === "P2002") {
      return { ok: false, error: `Eine Übung namens „${name}“ gibt es schon.` };
    }
    throw e;
  }

  revalidatePath("/exercises");
  return { ok: true };
}

export async function deleteExercise(id: string) {
  await requireTrainer();
  try {
    await prisma.exercise.delete({ where: { id } });
  } catch (e) {
    // onDelete: Restrict — Übung steckt noch in mindestens einem Plan
    if (prismaErrorCode(e) === "P2003") {
      const count = await prisma.planExercise.count({ where: { exerciseId: id } });
      return {
        ok: false as const,
        error: `Die Übung wird noch in ${count === 1 ? "einem Plan" : `${count} Plänen`} verwendet — bitte dort zuerst entfernen.`,
      };
    }
    throw e;
  }
  revalidatePath("/exercises");
  return { ok: true as const };
}

// Holt alle noch extern verlinkten Bilder nachträglich auf den Server
// (z.B. wenn der Download beim Speichern fehlgeschlagen ist).
export async function reimportExternalImages() {
  await requireTrainer();
  const externals = await prisma.exercise.findMany({
    where: { imageUrl: { startsWith: "http" } },
    select: { id: true, imageUrl: true },
  });
  let imported = 0;
  const failedNames: string[] = [];
  for (const ex of externals) {
    try {
      const local = await fetchAndStoreImage(ex.imageUrl!);
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { imageUrl: local },
      });
      imported++;
    } catch {
      const e = await prisma.exercise.findUnique({
        where: { id: ex.id },
        select: { name: true },
      });
      failedNames.push(e?.name ?? ex.id);
    }
  }
  revalidatePath("/exercises");
  return { ok: true as const, total: externals.length, imported, failedNames };
}
