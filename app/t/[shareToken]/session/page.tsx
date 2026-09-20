import { notFound, redirect } from "next/navigation";
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
  // Ohne Übungen gibt es nichts zu trainieren — die Workout-Phase würde
  // an exercises[0] scheitern (StartGate sperrt nur den Button, nicht die URL).
  if (plan.exercises.length === 0) redirect(`/t/${params.shareToken}`);

  // Werte des letzten abgeschlossenen Trainings – für den "Letztes Mal"-Hinweis
  // und die Wdh.-Vorbelegung (Gewicht wird separat über maxWeights vorbelegt).
  const lastSession = await prisma.workoutSession.findFirst({
    where: {
      planId: plan.id,
      clientName: account.displayName,
      status: "COMPLETED",
    },
    orderBy: { startedAt: "desc" },
    include: { setLogs: true },
  });
  const lastLogs: Record<
    string,
    Record<
      number,
      {
        weight: number | null;
        reps: number | null;
        durationMin: number | null;
      }
    >
  > = {};
  for (const log of lastSession?.setLogs ?? []) {
    (lastLogs[log.planExerciseId] ??= {})[log.setNumber] = {
      weight: log.weight,
      reps: log.reps,
      durationMin: log.durationMin,
    };
  }

  // Maximal je erreichtes Gewicht pro Übung, über ALLE Pläne dieses Kunden
  // hinweg (nicht nur diesen Plan) – Vorgabegewicht soll auch bei einer
  // schwächeren letzten Einheit das beste je geschaffte Gewicht zeigen.
  const exerciseIds = Array.from(
    new Set(plan.exercises.map((pe) => pe.exerciseId)),
  );
  const bestLogs = await prisma.setLog.findMany({
    where: {
      weight: { not: null },
      planExercise: { exerciseId: { in: exerciseIds } },
      session: { clientName: account.displayName, status: "COMPLETED" },
    },
    select: { weight: true, planExercise: { select: { exerciseId: true } } },
  });
  const maxWeights: Record<string, number> = {};
  for (const log of bestLogs) {
    const exerciseId = log.planExercise.exerciseId;
    if (log.weight != null && (maxWeights[exerciseId] ?? -Infinity) < log.weight) {
      maxWeights[exerciseId] = log.weight;
    }
  }

  return (
    <SessionFlowClient
      shareToken={params.shareToken}
      planId={plan.id}
      planName={plan.name}
      clientName={account.displayName}
      exercises={plan.exercises.map((pe) => ({
        planExerciseId: pe.id,
        exerciseId: pe.exerciseId,
        name: pe.exercise.name,
        imageUrl: pe.exercise.imageUrl,
        sets: pe.sets,
        targetReps: pe.targetReps,
        targetWeight: pe.targetWeight,
        isCardio: (pe.exercise.category ?? "").toLowerCase() === "cardio",
      }))}
      lastLogs={lastLogs}
      maxWeights={maxWeights}
    />
  );
}
