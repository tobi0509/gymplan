import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import QueueList, { type QueueItem } from "./QueueList";

export const dynamic = "force-dynamic";

// "Heute"-Tab: geordnete Trainings-Warteschlange. Rhythmus/Passwort/Abmelden
// liegen im Profil-Tab, die Statistik im Fortschritt-Tab.
export default async function MePage() {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const [preference, plans] = await Promise.all([
    prisma.trainingPreference.findUnique({
      where: { accountId: account.id },
    }),
    prisma.plan.findMany({
      where: { assignedToId: account.id },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { exercises: true } },
        sessions: { where: { status: "COMPLETED" }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  const totalSessions = await prisma.workoutSession.count({
    where: { clientName: account.displayName, status: "COMPLETED" },
  });

  const items: QueueItem[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    shareToken: p.shareToken,
    exerciseCount: p._count.exercises,
    done: p.sessions.length > 0,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-muted">
          GymPlan
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          Hi, {account.displayName}!
        </h1>
        <p className="text-muted">{totalSessions} abgeschlossene Trainings</p>
      </div>

      {items.length > 0 && (
        <section className="mb-6">
          <QueueList items={items} />
        </section>
      )}

      {/* Onboarding: noch kein Trainingsrhythmus hinterlegt */}
      {preference == null && (
        <section className="card mb-6 border-accent/40">
          <div className="text-lg font-semibold">Willkommen! 👋</div>
          <p className="mt-1 text-sm text-muted">
            Lege zuerst deinen Trainingsrhythmus fest — dein Trainer richtet
            danach deine Trainings ein.
          </p>
          <Link href="/profile" className="btn-primary mt-3 w-full">
            Trainingsrhythmus festlegen
          </Link>
        </section>
      )}

      {/* Warte-Status: Rhythmus gespeichert, aber noch keine Trainings zugeteilt */}
      {preference != null && items.length === 0 && (
        <section className="card mb-6 border-accent/40">
          <div className="text-lg font-semibold">
            Dein Trainer stellt gerade deine Trainings zusammen 💪
          </div>
          <p className="mt-1 text-sm text-muted">
            Sobald es fertig ist, siehst du hier deine Trainings.
          </p>
        </section>
      )}
    </main>
  );
}
