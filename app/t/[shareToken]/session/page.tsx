import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import SessionFlowClient from "./SessionFlowClient";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: { shareToken: string };
}) {
  const account = await requireAccount();
  const plan = await prisma.plan.findUnique({
    where: { shareToken: params.shareToken },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: true },
      },
    },
  });
  if (!plan) notFound();
  if (
    account.role === ROLE.CLIENT &&
    plan.assignedToId &&
    plan.assignedToId !== account.id
  ) {
    notFound();
  }

  return (
    <SessionFlowClient
      shareToken={params.shareToken}
      planId={plan.id}
      planName={plan.name}
      clientName={account.displayName}
      exercises={plan.exercises.map((pe) => ({
        planExerciseId: pe.id,
        name: pe.exercise.name,
        imageUrl: pe.exercise.imageUrl,
        sets: pe.sets,
        targetReps: pe.targetReps,
        targetWeight: pe.targetWeight,
      }))}
    />
  );
}
