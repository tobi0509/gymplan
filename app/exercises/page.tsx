import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer } from "@/lib/auth";
import ExercisesClient from "./ExercisesClient";
import ReimportButton from "./ReimportButton";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  await requireTrainer();
  const [exercises, muscles, externalCount] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: { muscles: true },
    }),
    prisma.muscle.findMany({ orderBy: { name: "asc" } }),
    prisma.exercise.count({ where: { imageUrl: { startsWith: "http" } } }),
  ]);

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Übungsdatenbank</h1>
          <p className="mt-1 text-muted">
            Jede Übung trägt die trainierten Muskeln in Prozent. Diese Werte
            steuern die Muskel-Abdeckung im Plan.
          </p>
        </div>
        <ReimportButton count={externalCount} />
        <ExercisesClient
          exercises={exercises.map((e) => ({
            id: e.id,
            name: e.name,
            equipment: e.equipment,
            category: e.category,
            imageUrl: e.imageUrl,
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
