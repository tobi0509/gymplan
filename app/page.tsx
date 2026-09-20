import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import PlansListClient from "./PlansListClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireTrainer();
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { exercises: true, sessions: true } },
      assignedTo: { select: { displayName: true } },
    },
  });
  const clients = await prisma.account.findMany({
    where: { role: ROLE.CLIENT },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  const exerciseCount = await prisma.exercise.count();

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Alle Trainings</h1>
          <p className="mt-1 text-muted">
            Nur-Lese-Übersicht über alle Trainings aller Kunden. Neue Trainings
            legst du direkt bei einem Kunden an. {exerciseCount} Übungen in der
            Datenbank.
          </p>
        </div>

        <PlansListClient
          plans={plans.map((p) => ({
            id: p.id,
            name: p.name,
            ownerName: p.ownerName,
            exerciseCount: p._count.exercises,
            sessionCount: p._count.sessions,
            assignedToId: p.assignedToId,
            assignedToName: p.assignedTo?.displayName ?? null,
          }))}
          clients={clients}
        />
      </main>
    </>
  );
}
