import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer } from "@/lib/auth";
import PlanBuilderClient from "./PlanBuilderClient";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: { id: string };
}) {
  await requireTrainer();
  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, displayName: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { include: { muscles: true } } },
      },
    },
  });
  if (!plan) notFound();

  const [allExercises, muscles] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: { muscles: true },
    }),
    prisma.muscle.findMany({ orderBy: { name: "asc" } }),
  ]);

  const backHref = plan.assignedTo
    ? `/clients/${plan.assignedTo.id}/plans`
    : "/clients";
  const backLabel = plan.assignedTo
    ? `${plan.assignedTo.displayName}: Trainings`
    : "Kunden";

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-tabbar md:py-8">
        <PlanBuilderClient
          plan={{ id: plan.id, name: plan.name, shareToken: plan.shareToken }}
          backHref={backHref}
          backLabel={backLabel}
          initialItems={plan.exercises.map((pe) => ({
            id: pe.id,
            exerciseId: pe.exerciseId,
            name: pe.exercise.name,
            equipment: pe.exercise.equipment,
            category: pe.exercise.category,
            order: pe.order,
            sets: pe.sets,
            targetReps: pe.targetReps,
            targetWeight: pe.targetWeight,
            contributions: pe.exercise.muscles.map((m) => ({
              muscleId: m.muscleId,
              percentage: m.percentage,
            })),
          }))}
          allExercises={allExercises.map((e) => ({
            id: e.id,
            name: e.name,
            equipment: e.equipment,
            contributions: e.muscles.map((m) => ({
              muscleId: m.muscleId,
              percentage: m.percentage,
            })),
          }))}
          muscles={muscles.map((m) => ({
            id: m.id,
            name: m.name,
            svgKey: m.svgKey,
            group: m.group,
          }))}
        />
      </main>
    </>
  );
}
