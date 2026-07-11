import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SessionFlowClient from "./SessionFlowClient";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: { shareToken: string };
}) {
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

  return (
    <SessionFlowClient
      shareToken={params.shareToken}
      planId={plan.id}
      planName={plan.name}
      exercises={plan.exercises.map((pe) => ({
        planExerciseId: pe.id,
        name: pe.exercise.name,
        sets: pe.sets,
        targetReps: pe.targetReps,
        targetWeight: pe.targetWeight,
      }))}
    />
  );
}
