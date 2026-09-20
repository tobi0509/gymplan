"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireTrainer } from "@/lib/auth";

export async function deletePlan(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.plan.delete({ where: { id } });
  revalidatePath("/");
}
