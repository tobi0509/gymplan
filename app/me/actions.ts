"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";

// Der Kunde speichert seinen Trainingsrhythmus: an welchen Wochentagen er
// Zeit hat und wie oft pro Woche er trainieren möchte. Auf dieser Basis
// teilt der Trainer die Standardwoche zu.
export async function saveTrainingPreference(formData: FormData) {
  const account = await requireAccount();
  if (account.role !== ROLE.CLIENT) redirect("/");

  const weekdays = Array.from(
    new Set(
      formData
        .getAll("weekday")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ).sort((a, b) => a - b);
  if (weekdays.length === 0) redirect("/me?err=days");

  const frequency = Math.min(
    7,
    Math.max(1, Math.round(Number(formData.get("frequency")) || 3)),
  );

  await prisma.trainingPreference.upsert({
    where: { accountId: account.id },
    update: { weekdays: JSON.stringify(weekdays), frequency },
    create: {
      accountId: account.id,
      weekdays: JSON.stringify(weekdays),
      frequency,
    },
  });

  revalidatePath("/me");
  revalidatePath("/clients");
  redirect("/me");
}
