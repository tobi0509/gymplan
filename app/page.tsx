import Link from "next/link";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { createPlan, deletePlan } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { exercises: true, sessions: true } },
    },
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
          {/* Plan-Liste */}
          <section className="space-y-3">
            {plans.length === 0 && (
              <div className="card text-muted">
                Noch keine Pläne. Erstelle rechts deinen ersten Plan.
              </div>
            )}
            {plans.map((p) => (
              <div key={p.id} className="card flex items-center justify-between">
                <div>
                  <Link
                    href={`/plans/${p.id}`}
                    className="text-lg font-semibold hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="chip">{p._count.exercises} Übungen</span>
                    <span className="chip">{p._count.sessions} Sessions</span>
                    <span className="chip">von {p.ownerName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/plans/${p.id}`} className="btn-ghost">
                    Öffnen
                  </Link>
                  <form action={deletePlan}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      className="btn-ghost text-danger"
                      type="submit"
                      aria-label="Plan löschen"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </section>

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
                  defaultValue="Trainer"
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
