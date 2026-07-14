import { headers } from "next/headers";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { getTargetWeekStart } from "@/lib/schedule";
import {
  deleteClientAccount,
  assignPlan,
  assignProgram,
  assignWeeklyProgram,
} from "./actions";
import ClientCreateForm from "./ClientCreateForm";
import ResetPasswordButton from "./ResetPasswordButton";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireTrainer();

  const clients = await prisma.account.findMany({
    where: { role: ROLE.CLIENT },
    orderBy: { displayName: "asc" },
    include: {
      plans: { select: { id: true, name: true, shareToken: true } },
      programs: { select: { id: true, name: true } },
    },
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
  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      assignedTo: { select: { displayName: true } },
    },
  });

  // Wochenplanungen der Zielwoche (Frequenz-Wunsch der Kunden)
  const targetWeekStart = getTargetWeekStart(new Date());
  const weekSchedules = await prisma.weeklySchedule.findMany({
    where: { weekStart: targetWeekStart },
    include: { program: { select: { name: true } } },
  });
  const scheduleByAccount = new Map(weekSchedules.map((s) => [s.accountId, s]));

  function describeSchedule(s: (typeof weekSchedules)[number]) {
    let dayLabels = "";
    try {
      const dates = (JSON.parse(s.selectedDays) as string[]).map(
        (iso) => new Date(iso),
      );
      dayLabels = dates
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) =>
          d.toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" }),
        )
        .join(", ");
      return { count: dates.length, dayLabels };
    } catch {
      return { count: 0, dayLabels: "" };
    }
  }

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
              const weekSchedule = scheduleByAccount.get(c.id);
              const weekInfo = weekSchedule
                ? describeSchedule(weekSchedule)
                : null;
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

                {/* Zugewiesene Programme & Pläne */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.programs.map((pr) => (
                    <form key={pr.id} action={assignProgram}>
                      <input type="hidden" name="programId" value={pr.id} />
                      <input type="hidden" name="accountId" value="" />
                      <button
                        className="chip text-accent hover:text-danger"
                        type="submit"
                        title="Programm-Zuweisung entfernen"
                      >
                        📋 {pr.name} ✕
                      </button>
                    </form>
                  ))}
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
                  {c.plans.length === 0 && c.programs.length === 0 && (
                    <span className="text-xs text-muted">
                      Noch kein Plan oder Programm zugewiesen.
                    </span>
                  )}
                </div>

                {/* Wochenplanung des Kunden (Zielwoche) */}
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  {weekSchedule && weekInfo && weekInfo.count > 0 ? (
                    <>
                      <div className="text-sm">
                        <span className="font-medium">Wochenplanung:</span>{" "}
                        <span className="text-accent">
                          {weekInfo.count}× gewünscht
                        </span>{" "}
                        <span className="text-muted">
                          ({weekInfo.dayLabels})
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        Programm: {weekSchedule.program?.name ?? "–"}{" "}
                        {weekSchedule.programSource === "TRAINER"
                          ? "(von dir zugewiesen)"
                          : "(automatisch)"}
                      </div>
                      {programs.length > 0 && (
                        <form
                          action={assignWeeklyProgram}
                          className="mt-2 flex gap-2"
                        >
                          <input
                            type="hidden"
                            name="scheduleId"
                            value={weekSchedule.id}
                          />
                          <select
                            name="programId"
                            className="input flex-1"
                            required
                          >
                            <option value="">Anderes Programm…</option>
                            {programs.map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.name}
                              </option>
                            ))}
                          </select>
                          <button className="btn-ghost" type="submit">
                            Für diese Woche
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted">
                      Noch keine Wochenplanung abgegeben.
                    </div>
                  )}
                </div>

                {/* Programm zuweisen */}
                {programs.length > 0 && (
                  <form action={assignProgram} className="flex gap-2">
                    <input type="hidden" name="accountId" value={c.id} />
                    <select name="programId" className="input flex-1" required>
                      <option value="">Programm zuweisen…</option>
                      {programs.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          📋 {pr.name}
                          {pr.assignedTo
                            ? ` (bei ${pr.assignedTo.displayName})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <button className="btn-ghost" type="submit">
                      Zuweisen
                    </button>
                  </form>
                )}

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
