import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer } from "@/lib/auth";
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

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
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
