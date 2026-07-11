"use server";

import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";

export async function startSession(
  planId: string,
  clientName: string,
  motivation: number,
) {
  const name = clientName.trim() || "Gast";
  // Client-Record pflegen (idempotent)
  await prisma.client.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  const session = await prisma.workoutSession.create({
    data: {
      planId,
      clientName: name,
      motivation,
      status: SESSION_STATUS.IN_PROGRESS,
    },
  });
  return { sessionId: session.id };
}

export type SetLogInput = {
  planExerciseId: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
};

export async function finishSession(
  sessionId: string,
  exertion: number,
  logs: SetLogInput[],
) {
  const valid = logs.filter((l) => l.weight != null || l.reps != null);
  if (valid.length) {
    await prisma.setLog.createMany({
      data: valid.map((l) => ({
        sessionId,
        planExerciseId: l.planExerciseId,
        setNumber: l.setNumber,
        weight: l.weight,
        reps: l.reps,
      })),
    });
  }
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      exertion,
      status: SESSION_STATUS.COMPLETED,
      finishedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function cancelSession(sessionId: string) {
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { status: SESSION_STATUS.CANCELLED, finishedAt: new Date() },
  });
  return { ok: true };
}
