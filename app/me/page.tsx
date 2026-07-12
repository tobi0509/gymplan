import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const plans = await prisma.plan.findMany({
    where: { assignedToId: account.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { exercises: true } } },
  });

  const sessions = await prisma.workoutSession.findMany({
    where: { clientName: account.displayName, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: 5,
    include: { plan: { select: { name: true, shareToken: true } } },
  });
  const totalSessions = await prisma.workoutSession.count({
    where: { clientName: account.displayName, status: "COMPLETED" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">
            GymPlan
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Hi, {account.displayName}!
          </h1>
          <p className="text-muted">
            {totalSessions} abgeschlossene Trainings
          </p>
        </div>
        <form action={logout}>
          <button className="btn-ghost" type="submit">
            Abmelden
          </button>
        </form>
      </div>

      <section className="mb-6 space-y-3">
        <h2 className="text-lg font-semibold">Deine Trainingspläne</h2>
        {plans.length === 0 && (
          <div className="card text-muted">
            Dir ist noch kein Plan zugewiesen. Dein Trainer schaltet ihn für
            dich frei.
          </div>
        )}
        {plans.map((p) => (
          <div key={p.id} className="card flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted">
                {p._count.exercises} Übungen · von {p.ownerName}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/t/${p.shareToken}/history`} className="btn-ghost">
                📈 Fortschritt
              </Link>
              <Link href={`/t/${p.shareToken}`} className="btn-primary">
                Trainieren
              </Link>
            </div>
          </div>
        ))}
      </section>

      {sessions.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold">Letzte Trainings</h2>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/t/${s.plan.shareToken}/history`}
              className="card flex items-center justify-between hover:border-accent/40"
            >
              <div>
                <div className="text-sm font-medium">{s.plan.name}</div>
                <div className="text-xs text-muted">
                  {s.startedAt.toLocaleDateString("de-DE", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="flex gap-1.5 text-xs">
                {s.motivation != null && (
                  <span className="chip">Motivation {s.motivation}</span>
                )}
                {s.exertion != null && (
                  <span className="chip">Anstrengung {s.exertion}</span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}

      <ChangePasswordForm />
    </main>
  );
}
