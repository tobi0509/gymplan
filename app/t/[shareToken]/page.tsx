import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { computeCoverage } from "@/lib/coverage";
import { EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import StartGate from "./StartGate";

export const dynamic = "force-dynamic";

export default async function ClientPlanPage({
  params,
}: {
  params: { shareToken: string };
}) {
  const plan = await prisma.plan.findUnique({
    where: { shareToken: params.shareToken },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { include: { muscles: true } } },
      },
    },
  });
  if (!plan) notFound();

  const muscles = await prisma.muscle.findMany({ orderBy: { name: "asc" } });

  const coverage = computeCoverage(
    plan.exercises.map((pe) => ({
      exerciseName: pe.exercise.name,
      sets: pe.sets,
      contributions: pe.exercise.muscles.map((m) => ({
        muscleId: m.muscleId,
        percentage: m.percentage,
      })),
    })),
  );
  const bodyData = toBodyData(
    muscles.map((m) => ({ id: m.id, name: m.name, svgKey: m.svgKey })),
    coverage,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="text-xs uppercase tracking-widest text-muted">
          Trainingsplan von {plan.ownerName}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{plan.name}</h1>
      </div>

      <div className="card mb-4">
        <BodyMap data={bodyData} />
      </div>

      <div className="card mb-6">
        <h2 className="mb-3 text-lg font-semibold">
          Übungen ({plan.exercises.length})
        </h2>
        <div className="space-y-2">
          {plan.exercises.map((pe, i) => (
            <div
              key={pe.id}
              className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface text-xs text-muted">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium">{pe.exercise.name}</div>
                  <div className="text-xs text-muted">
                    {EQUIPMENT_LABEL[pe.exercise.equipment as Equipment] ??
                      pe.exercise.equipment}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted">
                {pe.sets} × {pe.targetReps ?? "–"}
                {pe.targetWeight ? ` · ${pe.targetWeight} kg` : ""}
              </div>
            </div>
          ))}
          {plan.exercises.length === 0 && (
            <div className="text-sm text-muted">
              Dieser Plan enthält noch keine Übungen.
            </div>
          )}
        </div>
      </div>

      <StartGate
        shareToken={params.shareToken}
        disabled={plan.exercises.length === 0}
      />
    </main>
  );
}
