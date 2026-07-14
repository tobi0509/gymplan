"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTrainer } from "@/lib/auth";

export async function createProgram(formData: FormData) {
  const trainer = await requireTrainer();
  const name = String(formData.get("name") || "").trim();
  const ownerName =
    String(formData.get("ownerName") || "").trim() || trainer.displayName;
  if (!name) return;
  const program = await prisma.program.create({ data: { name, ownerName } });
  redirect(`/programs/${program.id}`);
}

export async function deleteProgram(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.program.delete({ where: { id } });
  revalidatePath("/programs");
}

export async function renameProgram(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await prisma.program.update({ where: { id }, data: { name } });
  revalidatePath(`/programs/${id}`);
}

export async function addProgramDay(formData: FormData) {
  await requireTrainer();
  const programId = String(formData.get("programId") || "");
  const planId = String(formData.get("planId") || "");
  if (!programId || !planId) return;
  const order = await prisma.programDay.count({ where: { programId } });
  try {
    await prisma.programDay.create({ data: { programId, planId, order } });
  } catch {
    // Duplikat (Plan schon im Programm) still ignorieren
  }
  revalidatePath(`/programs/${programId}`);
}

export async function removeProgramDay(formData: FormData) {
  await requireTrainer();
  const dayId = String(formData.get("dayId") || "");
  if (!dayId) return;
  const day = await prisma.programDay.findUnique({ where: { id: dayId } });
  if (!day) return;
  await prisma.$transaction(async (tx) => {
    await tx.programDay.delete({ where: { id: dayId } });
    // Verbleibende Tage lückenlos neu nummerieren
    const rest = await tx.programDay.findMany({
      where: { programId: day.programId },
      orderBy: { order: "asc" },
    });
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].order !== i) {
        await tx.programDay.update({ where: { id: rest[i].id }, data: { order: i } });
      }
    }
  });
  revalidatePath(`/programs/${day.programId}`);
}

export async function moveProgramDay(formData: FormData) {
  await requireTrainer();
  const dayId = String(formData.get("dayId") || "");
  const dir = String(formData.get("dir") || "");
  if (!dayId || (dir !== "up" && dir !== "down")) return;
  const day = await prisma.programDay.findUnique({ where: { id: dayId } });
  if (!day) return;
  const neighbor = await prisma.programDay.findFirst({
    where: {
      programId: day.programId,
      order: dir === "up" ? { lt: day.order } : { gt: day.order },
    },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.programDay.update({ where: { id: day.id }, data: { order: neighbor.order } }),
    prisma.programDay.update({ where: { id: neighbor.id }, data: { order: day.order } }),
  ]);
  revalidatePath(`/programs/${day.programId}`);
}
