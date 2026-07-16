import { headers } from "next/headers";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { parseWeekdays, startOfWeek, addDays } from "@/lib/schedule";
import { activityStatus, frequencyStatus, weekSyncStatus } from "@/lib/clientStatus";
import ClientCreateForm from "./ClientCreateForm";
import ClientsListClient, { type ClientRow } from "./ClientsListClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireTrainer();

  const clients = await prisma.account.findMany({
    where: { role: ROLE.CLIENT },
    orderBy: { displayName: "asc" },
    include: {
      plans: { select: { name: true } },
      programs: { select: { name: true } },
      trainingPreference: {
        select: { weekdays: true, frequency: true, updatedAt: true },
      },
      standardWeek: {
        select: { updatedAt: true, _count: { select: { entries: true } } },
      },
    },
  });

  const host = headers().get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const loginUrl = host ? `${proto}://${host}/login` : "/login";

  // Trainings-Aktivität pro Kunde (Anzahl + letztes Training, gesamt)
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

  // Trainings dieser Woche pro Kunde (für die Soll-Frequenz-Ampel)
  const weekStart = startOfWeek(new Date());
  const weekStats = await prisma.workoutSession.groupBy({
    by: ["clientName"],
    where: {
      status: "COMPLETED",
      startedAt: { gte: weekStart, lt: addDays(weekStart, 7) },
    },
    _count: { _all: true },
  });
  const weekCountByName = new Map(weekStats.map((s) => [s.clientName, s._count._all]));

  const rows: ClientRow[] = clients.map((c) => {
    const stats = statsByName.get(c.displayName);
    const act = activityStatus(stats?.last ?? null);
    const pref = c.trainingPreference;
    const weekdays = pref ? parseWeekdays(pref.weekdays) : [];
    const freq = pref
      ? frequencyStatus(pref.frequency, weekCountByName.get(c.displayName) ?? 0)
      : null;
    const weekWarning = weekSyncStatus(pref, c.standardWeek);
    const sevTone = (t: string | undefined) => (t === "text-danger" ? 2 : t === "text-warn" ? 1 : 0);
    const severity = Math.max(
      sevTone(act.tone),
      sevTone(freq?.tone),
      sevTone(weekWarning?.tone),
    ) as 0 | 1 | 2;

    return {
      id: c.id,
      displayName: c.displayName,
      username: c.username,
      totalSessions: stats?.count ?? 0,
      activityLabel: act.label,
      activityTone: act.tone,
      activityDays: act.days,
      frequency: freq,
      weekdays,
      planNames: c.plans.map((p) => p.name),
      programNames: c.programs.map((p) => p.name),
      weekWarning,
      severity,
    };
  });

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kunden</h1>
          <p className="mt-1 text-muted">
            Lege Zugänge an, weise Pläne zu und verschicke die Zugangsdaten.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <ClientsListClient clients={rows} loginUrl={loginUrl} />

          <aside>
            <ClientCreateForm loginUrl={loginUrl} />
          </aside>
        </div>
      </main>
    </>
  );
}
