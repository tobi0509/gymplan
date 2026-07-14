import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import { mayAccessPlan } from "@/lib/access";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { computeCoverage } from "@/lib/coverage";
import { EQUIPMENT_LABEL, type Equipment } from "@/lib/constants";
import StartGate from "./StartGate";
import ExerciseAccordion, {
  type AccordionExercise,
} from "./ExerciseAccordion";

export const dynamic = "force-dynamic";

export default async function ClientPlanPage({
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
        include: { exercise: { include: { muscles: true } } },
      },
    },
  });
  if (!plan) notFound();
  // Kunden sehen nur Pläne, auf die sie Zugriff haben (direkt/Programm/frei)
  if (!(await mayAccessPlan(account, plan))) notFound();

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

  // Daten fürs Vorschau-Akkordeon serverseitig auflösen
  const muscleNameById = new Map(muscles.map((m) => [m.id, m.name]));
  const accordionItems: AccordionExercise[] = plan.exercises.map((pe) => ({
    id: pe.id,
    name: pe.exercise.name,
    equipmentLabel:
      EQUIPMENT_LABEL[pe.exercise.equipment as Equipment] ??
      pe.exercise.equipment,
    category: pe.exercise.category,
    imageUrl: pe.exercise.imageUrl,
    sets: pe.sets,
    targetReps: pe.targetReps,
    targetWeight: pe.targetWeight,
    muscles: pe.exercise.muscles
      .map((m) => ({
        name: muscleNameById.get(m.muscleId) ?? "?",
        percentage: m.percentage,
      }))
      .sort((a, b) => b.percentage - a.percentage),
  }));

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
        <ExerciseAccordion items={accordionItems} />
        {plan.exercises.length === 0 && (
          <div className="text-sm text-muted">
            Dieser Plan enthält noch keine Übungen.
          </div>
        )}
      </div>

      <StartGate
        shareToken={params.shareToken}
        planId={plan.id}
        disabled={plan.exercises.length === 0}
        clientName={account.displayName}
      />

      <Link
        href={`/t/${params.shareToken}/history`}
        className="btn-ghost mt-3 w-full"
      >
        📈 Verlauf & Fortschritt ansehen
      </Link>

      <div className="mt-4 text-center">
        <Link
          href={account.role === ROLE.CLIENT ? "/me" : "/"}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Zur Übersicht
        </Link>
      </div>
    </main>
  );
}
