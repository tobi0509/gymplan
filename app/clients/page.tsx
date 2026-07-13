import { headers } from "next/headers";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { deleteClientAccount, assignPlan } from "./actions";
import ClientCreateForm from "./ClientCreateForm";
import ResetPasswordButton from "./ResetPasswordButton";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireTrainer();

  const clients = await prisma.account.findMany({
    where: { role: ROLE.CLIENT },
    orderBy: { displayName: "asc" },
    include: { plans: { select: { id: true, name: true, shareToken: true } } },
  });
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      assignedToId: true,
      assignedTo: { select: { displayName: true } },
    },
  });

  const host = headers().get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const loginUrl = host ? `${proto}://${host}/login` : "/login";

  // Trainings-Aktivität pro Kunde (Anzahl + letztes Training)
  const sessionStats = await prisma.workoutSession.groupBy({
    by: ["clientName"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
    _max: { startedAt: true },
  });
  const statsByName = new Map(
    sessionStats.map((s) => [
      s.clientName,
      { count: s._count._all, last: s._max.startedAt },
    ]),
  );

  // "vor X Tagen"-Label + Warnstufe (>14 Tage oder nie = rot, >7 Tage = gelb)
  function activity(last: Date | null | undefined) {
    if (!last) {
      return { label: "Noch kein Training", tone: "text-danger" };
    }
    const days = Math.floor((Date.now() - last.getTime()) / 86400000);
    const label =
      days === 0 ? "Heute trainiert" : days === 1 ? "Gestern trainiert" : `Vor ${days} Tagen trainiert`;
    const tone =
      days > 14 ? "text-danger" : days > 7 ? "text-warn" : "text-accent";
    return { label, tone };
  }

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Kunden</h1>
          <p className="mt-1 text-muted">
            Lege Zugänge an, weise Pläne zu und verschicke die Zugangsdaten.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            {clients.length === 0 && (
              <div className="card text-muted">
                Noch keine Kunden. Lege rechts den ersten Zugang an.
              </div>
            )}
            {clients.map((c) => {
              const stats = statsByName.get(c.displayName);
              const act = activity(stats?.last);
              return (
              <div key={c.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{c.displayName}</div>
                    <div className="text-xs text-muted">
                      Benutzername: <span className="font-mono">{c.username}</span>
                      {" · "}
                      {stats?.count ?? 0} Trainings
                    </div>
                    <div className={`mt-0.5 text-xs font-medium ${act.tone}`}>
                      {act.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResetPasswordButton accountId={c.id} loginUrl={loginUrl} />
                    <form action={deleteClientAccount}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        className="btn-ghost text-danger"
                        type="submit"
                        aria-label={`Zugang von ${c.displayName} löschen`}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </div>

                {/* Zugewiesene Pläne */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.plans.map((p) => (
                    <form key={p.id} action={assignPlan}>
                      <input type="hidden" name="planId" value={p.id} />
                      <input type="hidden" name="accountId" value="" />
                      <button
                        className="chip hover:text-danger"
                        type="submit"
                        title="Zuweisung entfernen"
                      >
                        {p.name} ✕
                      </button>
                    </form>
                  ))}
                  {c.plans.length === 0 && (
                    <span className="text-xs text-muted">
                      Noch kein Plan zugewiesen.
                    </span>
                  )}
                </div>

                {/* Plan zuweisen */}
                <form action={assignPlan} className="flex gap-2">
                  <input type="hidden" name="accountId" value={c.id} />
                  <select name="planId" className="input flex-1" required>
                    <option value="">Plan auswählen…</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.assignedTo
                          ? ` (bei ${p.assignedTo.displayName})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <button className="btn-ghost" type="submit">
                    Zuweisen
                  </button>
                </form>
              </div>
              );
            })}
          </section>

          <aside>
            <ClientCreateForm loginUrl={loginUrl} />
          </aside>
        </div>
      </main>
    </>
  );
}
