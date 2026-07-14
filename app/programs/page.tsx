import Link from "next/link";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer } from "@/lib/auth";
import { createProgram, deleteProgram } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const trainer = await requireTrainer();
  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { days: true } },
      assignedTo: { select: { displayName: true } },
    },
  });

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Programme</h1>
          <p className="mt-1 text-muted">
            Ein Programm bündelt mehrere Pläne zu einem Trainingszyklus (z.B.
            3er-Split: Tag 1 Push, Tag 2 Pull, Tag 3 Beine).
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            {programs.length === 0 && (
              <div className="card text-muted">
                Noch keine Programme. Erstelle rechts dein erstes Programm.
              </div>
            )}
            {programs.map((p) => (
              <div key={p.id} className="card flex items-center justify-between">
                <div>
                  <Link
                    href={`/programs/${p.id}`}
                    className="text-lg font-semibold hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="chip">{p._count.days} Tage</span>
                    <span className="chip">von {p.ownerName}</span>
                    {p.assignedTo && (
                      <span className="chip text-accent">
                        → {p.assignedTo.displayName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/programs/${p.id}`} className="btn-ghost">
                    Öffnen
                  </Link>
                  <form action={deleteProgram}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      className="btn-ghost text-danger"
                      type="submit"
                      aria-label="Programm löschen"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </section>

          <aside>
            <form action={createProgram} className="card space-y-3">
              <h2 className="text-lg font-semibold">Neues Programm</h2>
              <div>
                <label className="label" htmlFor="name">
                  Programm-Name
                </label>
                <input
                  id="name"
                  name="name"
                  className="input"
                  placeholder="z.B. 3er-Split Anfänger"
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
                  defaultValue={trainer.displayName}
                />
              </div>
              <button className="btn-primary w-full" type="submit">
                Programm erstellen
              </button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}
