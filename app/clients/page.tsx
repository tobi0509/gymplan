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

  // Namen der Kunden für Sessions-Zählung
  const sessionCounts = await prisma.workoutSession.groupBy({
    by: ["clientName"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
  });
  const countByName = new Map(
    sessionCounts.map((s) => [s.clientName, s._count._all]),
  );

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
            {clients.map((c) => (
              <div key={c.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{c.displayName}</div>
                    <div className="text-xs text-muted">
                      Benutzername: <span className="font-mono">{c.username}</span>
                      {" · "}
                      {countByName.get(c.displayName) ?? 0} Trainings
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
            ))}
          </section>

          <aside>
            <ClientCreateForm loginUrl={loginUrl} />
          </aside>
        </div>
      </main>
    </>
  );
}
