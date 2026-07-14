import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { createPlan } from "./actions";
import PlansListClient from "./PlansListClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const trainer = await requireTrainer();
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Deine Trainingspläne</h1>
          <p className="mt-1 text-muted">
            Erstelle einen Wochenplan, sieh die Muskel-Abdeckung live und teile ihn
            per Link. {exerciseCount} Übungen in der Datenbank.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Plan-Liste mit Kunden-Filter */}
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

          {/* Neuer Plan */}
          <aside>
            <form action={createPlan} className="card space-y-3">
              <h2 className="text-lg font-semibold">Neuer Plan</h2>
              <div>
                <label className="label" htmlFor="name">
                  Plan-Name
                </label>
                <input
                  id="name"
                  name="name"
                  className="input"
                  placeholder="z.B. Ganzkörper Woche A"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="ownerName">
                  Trainer
                </label>
                <input
                  id="ownerName"
                  name="ownerName"
                  className="input"
                  placeholder="Dein Name"
                  defaultValue={trainer.displayName}
                />
              </div>
              <button className="btn-primary w-full" type="submit">
                Plan erstellen
              </button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}
