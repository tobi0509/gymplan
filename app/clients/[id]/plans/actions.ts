"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTrainer, ROLE } from "@/lib/auth";

async function requireClientAccount(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.role !== ROLE.CLIENT) {
    throw new Error("Unbekannter Kunde");
  }
  return account;
}

export async function createQueueEntry(formData: FormData) {
  const trainer = await requireTrainer();
  const accountId = String(formData.get("accountId") || "");
  const name = String(formData.get("name") || "").trim();
  await requireClientAccount(accountId);
  if (!name) return;
  // max(order)+1 statt count: nach Löschungen erzeugt count Duplikate.
  const plan = await prisma.$transaction(async (tx) => {
    const max = await tx.plan.aggregate({
      where: { assignedToId: accountId },
      _max: { order: true },
    });
    return tx.plan.create({
      data: {
        name,
        ownerName: trainer.displayName,
        assignedToId: accountId,
        order: (max._max.order ?? -1) + 1,
      },
    });
  });
  redirect(`/plans/${plan.id}`);
}

export async function renameQueueEntry(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  const accountId = String(formData.get("accountId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await prisma.plan.update({ where: { id }, data: { name } });
  revalidatePath(`/clients/${accountId}/plans`);
}

export async function deleteQueueEntry(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  const accountId = String(formData.get("accountId") || "");
  if (!id) return;
  await prisma.plan.delete({ where: { id } });
  revalidatePath(`/clients/${accountId}/plans`);
  revalidatePath(`/clients/${accountId}`);
}

// Direktes Setzen der kompletten Reihenfolge (nach Drag-and-Drop).
export async function reorderQueueEntries(accountId: string, orderedIds: string[]) {
  await requireTrainer();
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.plan.update({
        where: { id, assignedToId: accountId },
        data: { order: i },
      }),
    ),
  );
  return { ok: true };
}
