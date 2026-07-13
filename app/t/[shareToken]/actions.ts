"use server";

import { prisma } from "@/lib/prisma";
import { SESSION_STATUS } from "@/lib/constants";
import { requireAccount, ROLE } from "@/lib/auth";
import { FUNNY_SAYINGS, formatSaying } from "@/lib/funnySayings";

// Kunden dürfen nur Pläne nutzen, die ihnen (oder niemandem) zugewiesen sind.
async function requirePlan(planId: string) {
  const account = await requireAccount();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan nicht gefunden");
  if (
    account.role === ROLE.CLIENT &&
    plan.assignedToId &&
    plan.assignedToId !== account.id
  ) {
    throw new Error("Kein Zugriff auf diesen Plan");
  }
  return { account, plan };
}

export async function startSession(planId: string, motivation: number) {
  const { account } = await requirePlan(planId);
  const name = account.displayName;
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

// Nur eigene, laufende Sessions dürfen abgeschlossen/abgebrochen werden.
async function requireOwnSession(sessionId: string) {
  const account = await requireAccount();
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error("Session nicht gefunden");
  if (
    account.role === ROLE.CLIENT &&
    session.clientName !== account.displayName
  ) {
    throw new Error("Kein Zugriff auf diese Session");
  }
  return { account, session };
}

// Zieht den nächsten GainsFire-Spruch für den eingeloggten Account.
// Beim ersten Mal wird die Spruchliste pro Account zufällig gemischt und
// persistiert; danach wird sie der Reihe nach abgearbeitet (zyklisch).
export async function drawFunnySaying(
  sessionId: string,
  totals: { weight: number; reps: number },
): Promise<{ text: string; weight: number }> {
  const { account, session } = await requireOwnSession(sessionId);

  let order: number[] = [];
  try {
    order = account.funnyOrder ? JSON.parse(account.funnyOrder) : [];
  } catch {
    order = [];
  }
  if (order.length !== FUNNY_SAYINGS.length) {
    // Fisher-Yates-Shuffle (auch falls sich die Katalog-Größe mal ändert)
    order = Array.from({ length: FUNNY_SAYINGS.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  const index = order[account.funnyCursor % order.length];
  await prisma.account.update({
    where: { id: account.id },
    data: {
      funnyOrder: JSON.stringify(order),
      funnyCursor: (account.funnyCursor + 1) % order.length,
    },
  });

  const hours = Math.max(0, Date.now() - session.startedAt.getTime()) / 3.6e6;
  const weight = Math.round(totals.weight);
  const text = formatSaying(FUNNY_SAYINGS[index], {
    weight,
    count: Math.round(totals.reps),
    calories: Math.round(250 * hours),
  });
  return { text, weight };
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
  await requireOwnSession(sessionId);
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
  await requireOwnSession(sessionId);
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { status: SESSION_STATUS.CANCELLED, finishedAt: new Date() },
  });
  return { ok: true };
}

export type HistorySession = {
  id: string;
  date: string; // ISO
  motivation: number | null;
  exertion: number | null;
  durationMin: number | null;
  totalVolume: number; // Σ Gewicht × Wdh.
  totalSets: number;
  exercises: {
    name: string;
    topWeight: number | null;
    sets: { setNumber: number; weight: number | null; reps: number | null }[];
  }[];
};

// Verlauf des eingeloggten Kunden; Trainer sehen den Verlauf des Kunden,
// dem der Plan zugewiesen ist.
export async function getHistory(shareToken: string): Promise<{
  clientName: string;
  sessions: HistorySession[];
}> {
  const account = await requireAccount();
  const plan = await prisma.plan.findUnique({
    where: { shareToken },
    include: { assignedTo: { select: { id: true, displayName: true } } },
  });
  if (!plan) return { clientName: account.displayName, sessions: [] };

  let clientName = account.displayName;
  if (account.role === ROLE.TRAINER && plan.assignedTo) {
    clientName = plan.assignedTo.displayName;
  }
  if (
    account.role === ROLE.CLIENT &&
    plan.assignedToId &&
    plan.assignedToId !== account.id
  ) {
    return { clientName, sessions: [] };
  }

  const sessions = await prisma.workoutSession.findMany({
    where: {
      planId: plan.id,
      clientName,
      status: SESSION_STATUS.COMPLETED,
    },
    orderBy: { startedAt: "asc" },
    include: {
      setLogs: {
        include: { planExercise: { include: { exercise: true } } },
      },
    },
  });

  const mapped = sessions.map((s) => {
    // Logs nach Übung gruppieren (Reihenfolge nach order)
    const byExercise = new Map<
      string,
      {
        name: string;
        order: number;
        sets: { setNumber: number; weight: number | null; reps: number | null }[];
      }
    >();
    let totalVolume = 0;
    for (const log of s.setLogs) {
      const ex = log.planExercise.exercise;
      const key = log.planExerciseId;
      if (!byExercise.has(key)) {
        byExercise.set(key, {
          name: ex.name,
          order: log.planExercise.order,
          sets: [],
        });
      }
      byExercise.get(key)!.sets.push({
        setNumber: log.setNumber,
        weight: log.weight,
        reps: log.reps,
      });
      if (log.weight != null && log.reps != null) {
        totalVolume += log.weight * log.reps;
      }
    }

    const exercises = Array.from(byExercise.values())
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        name: e.name,
        topWeight: e.sets.reduce<number | null>(
          (max, st) => (st.weight != null && (max == null || st.weight > max) ? st.weight : max),
          null,
        ),
        sets: e.sets.sort((a, b) => a.setNumber - b.setNumber),
      }));

    const durationMin =
      s.finishedAt != null
        ? Math.max(
            0,
            Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 60000),
          )
        : null;

    return {
      id: s.id,
      date: s.startedAt.toISOString(),
      motivation: s.motivation,
      exertion: s.exertion,
      durationMin,
      totalVolume: Math.round(totalVolume),
      totalSets: s.setLogs.length,
      exercises,
    };
  });

  return { clientName, sessions: mapped };
}
