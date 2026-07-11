import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import ExercisesClient from "./ExercisesClient";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const [exercises, muscles] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: { muscles: true },
    }),
    prisma.muscle.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Übungsdatenbank</h1>
          <p className="mt-1 text-muted">
            Jede Übung trägt die trainierten Muskeln in Prozent. Diese Werte
            steuern die Muskel-Abdeckung im Plan.
          </p>
        </div>
        <ExercisesClient
          exercises={exercises.map((e) => ({
            id: e.id,
            name: e.name,
            equipment: e.equipment,
            category: e.category,
            muscles: e.muscles.map((m) => ({
              muscleId: m.muscleId,
              percentage: m.percentage,
            })),
          }))}
          muscles={muscles.map((m) => ({
            id: m.id,
            name: m.name,
            group: m.group,
          }))}
        />
      </main>
    </>
  );
}
