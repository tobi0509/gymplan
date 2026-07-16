import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import BodyMap, { toBodyData } from "@/components/BodyMap";
import { prisma } from "@/lib/prisma";
import { requireTrainer } from "@/lib/auth";
import { computeCoverage, TARGET_SESSIONS } from "@/lib/coverage";
import {
  renameProgram,
  addProgramDay,
  removeProgramDay,
  moveProgramDay,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireTrainer();
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { displayName: true } },
      days: {
        orderBy: { order: "asc" },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              _count: { select: { exercises: true } },
              exercises: {
                include: { exercise: { include: { muscles: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!program) notFound();

  const usedPlanIds = new Set(program.days.map((d) => d.planId));
  const plans = await prisma.plan.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const availablePlans = plans.filter((p) => !usedPlanIds.has(p.id));

  // Muskel-Abdeckung in Summe über alle Tage des Programms.
  // 100 % skaliert mit der Tage-Anzahl, damit die Karte die Wochen-Balance
  // zeigt statt überall auf 100 % zu stehen.
  const muscles = await prisma.muscle.findMany({ orderBy: { name: "asc" } });
  const coverage = computeCoverage(
    program.days.flatMap((d) =>
      d.plan.exercises.map((pe) => ({
        exerciseName: pe.exercise.name,
        sets: pe.sets,
        contributions: pe.exercise.muscles.map((m) => ({
          muscleId: m.muscleId,
          percentage: m.percentage,
        })),
      })),
    ),
    TARGET_SESSIONS * Math.max(1, program.days.length),
  );
  const bodyData = toBodyData(
    muscles.map((m) => ({ id: m.id, name: m.name, svgKey: m.svgKey })),
    coverage,
  );
  const legend = muscles
    .map((m) => ({ id: m.id, name: m.name, pct: coverage[m.id]?.coveragePct ?? 0 }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-6">
          <Link href="/programs" className="text-sm text-muted hover:text-foreground">
            ← Alle Programme
          </Link>
          <form action={renameProgram} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={program.id} />
            <input
              name="name"
              defaultValue={program.name}
              className="input max-w-sm text-xl font-bold"
              aria-label="Programm-Name"
              required
            />
            <button className="btn-ghost" type="submit">
              Speichern
            </button>
          </form>
          <p className="mt-1 text-sm text-muted">
            {program.assignedTo
              ? `Zugewiesen an ${program.assignedTo.displayName}`
              : "Noch keinem Kunden zugewiesen – Zuweisung unter Kunden."}
          </p>
        </div>

        <section className="space-y-2">
          {program.days.length === 0 && (
            <div className="card text-muted">
              Noch keine Tage. Füge unten den ersten Plan hinzu.
            </div>
          )}
          {program.days.map((d, i) => (
            <div
              key={d.id}
              className="card flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="chip text-accent">Tag {i + 1}</span>
                <div>
                  <Link
                    href={`/plans/${d.plan.id}`}
                    className="font-semibold hover:text-accent"
                  >
                    {d.plan.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {d.plan._count.exercises} Übungen
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <form action={moveProgramDay}>
                  <input type="hidden" name="dayId" value={d.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button
                    className="btn-ghost px-2"
                    type="submit"
                    disabled={i === 0}
                    aria-label={`Tag ${i + 1} nach oben`}
                  >
                    ▲
                  </button>
                </form>
                <form action={moveProgramDay}>
                  <input type="hidden" name="dayId" value={d.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    className="btn-ghost px-2"
                    type="submit"
                    disabled={i === program.days.length - 1}
                    aria-label={`Tag ${i + 1} nach unten`}
                  >
                    ▼
                  </button>
                </form>
                <form action={removeProgramDay}>
                  <input type="hidden" name="dayId" value={d.id} />
                  <button
                    className="btn-ghost text-danger"
                    type="submit"
                    aria-label={`Tag ${i + 1} entfernen`}
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>

        {program.days.length > 0 && (
          <div className="card mt-6">
            <h2 className="mb-1 text-lg font-semibold">
              Trainierte Muskeln (gesamt)
            </h2>
            <p className="mb-3 text-xs text-muted">
              Summe über alle {program.days.length} Tage · 100 % = voll
              abgedeckt über die Woche.
            </p>
            <BodyMap data={bodyData} />
            <div className="mt-4 space-y-1.5">
              {legend.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs">{m.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${Math.round(m.pct)}%`,
                        opacity: m.pct >= 100 ? 1 : 0.55 + (m.pct / 100) * 0.45,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted">
                    {Math.round(m.pct)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={addProgramDay} className="card mt-4 flex gap-2">
          <input type="hidden" name="programId" value={program.id} />
          <select name="planId" className="input flex-1" required>
            <option value="">Plan auswählen…</option>
            {availablePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Tag hinzufügen
          </button>
        </form>
      </main>
    </>
  );
}
