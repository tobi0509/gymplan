import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/auth";
import { mayAccessPlan } from "@/lib/access";
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
  if (!(await mayAccessPlan(account, plan))) notFound();

  // Werte des letzten abgeschlossenen Trainings – zum Vorbelegen der Inputs
  // und für den "Letztes Mal"-Hinweis.
  const lastSession = await prisma.workoutSession.findFirst({
    where: {
      planId: plan.id,
      clientName: account.displayName,
      status: "COMPLETED",
    },
    orderBy: { startedAt: "desc" },
    include: { setLogs: true },
  });
  const lastLogs: Record<string, Record<number, { weight: number | null; reps: number | null }>> = {};
  for (const log of lastSession?.setLogs ?? []) {
    (lastLogs[log.planExerciseId] ??= {})[log.setNumber] = {
      weight: log.weight,
      reps: log.reps,
    };
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
      lastLogs={lastLogs}
    />
  );
}
