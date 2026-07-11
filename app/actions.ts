"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPlan(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim() || "Trainer";
  if (!name) return;
  const plan = await prisma.plan.create({ data: { name, ownerName } });
  redirect(`/plans/${plan.id}`);
}

export async function deletePlan(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.plan.delete({ where: { id } });
  revalidatePath("/");
}
