import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import LineChart from "@/components/LineChart";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { addDays, startOfWeek, WEEKDAY_LABELS } from "@/lib/schedule";
import { getEffectiveWeek } from "@/lib/week";
import { activityStatus, frequencyStatus, weekSyncStatus, getClientTrainingStats } from "@/lib/clientStatus";
import { assignPlan, assignProgram, deleteClientAccount } from "../actions";
import ResetPasswordButton from "../ResetPasswordButton";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireTrainer();
  const client = await prisma.account.findUnique({
    where: { id: params.id },
    include: {
      plans: { select: { id: true, name: true, shareToken: true } },
      programs: { select: { id: true, name: true } },
      trainingPreference: true,
      standardWeek: { select: { updatedAt: true } },
    },
  });
  if (!client || client.role !== ROLE.CLIENT) notFound();

  const host = headers().get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const loginUrl = host ? `${proto}://${host}/login` : "/login";

  const currentWeekStart = startOfWeek(new Date());
  const [lastSession, weekSessionCount, stats, allPlans, allPrograms, effectiveWeek] =
    await Promise.all([
      prisma.workoutSession.aggregate({
        where: { clientName: client.displayName, status: "COMPLETED" },
        _max: { startedAt: true },
      }),
      prisma.workoutSession.count({
        where: {
          clientName: client.displayName,
          status: "COMPLETED",
          startedAt: { gte: currentWeekStart, lt: addDays(currentWeekStart, 7) },
        },
      }),
      getClientTrainingStats(client.displayName),
      prisma.plan.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          assignedTo: { select: { displayName: true } },
        },
      }),
      prisma.program.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          assignedTo: { select: { displayName: true } },
        },
      }),
      getEffectiveWeek(client.id, currentWeekStart),
    ]);

  const act = activityStatus(lastSession._max.startedAt);
  const freq = client.trainingPreference
    ? frequencyStatus(client.trainingPreference.frequency, weekSessionCount)
    : null;
  const sync = weekSyncStatus(client.trainingPreference, client.standardWeek);

  const planByWeekday = new Map(effectiveWeek.entries.map((e) => [e.weekday, e.plan.name]));
  const labels = stats.sessions.map((s) => shortDate(s.date));

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link href="/clients" className="text-sm text-muted hover:text-foreground">
            ← Kunden
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{client.displayName}</h1>
            <span className={`text-sm font-medium ${act.tone}`}>{act.label}</span>
          </div>
          <p className="text-xs text-muted">
            Benutzername: <span className="font-mono">{client.username}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 flex flex-wrap gap-2">
          <ResetPasswordButton accountId={client.id} loginUrl={loginUrl} />
          <Link href={`/clients/${client.id}/week`} className="btn-ghost">
            Wochenprogramm bearbeiten
          </Link>
          <form action={deleteClientAccount}>
            <input type="hidden" name="id" value={client.id} />
            <button className="btn-ghost text-danger" type="submit">
              Zugang löschen
            </button>
          </form>
        </div>

        {/* Diese Woche */}
        <div className="card mb-6 space-y-2">
          <h2 className="text-lg font-semibold">Diese Woche</h2>
          {client.trainingPreference ? (
            <p className="text-sm text-muted">
              Möchte {client.trainingPreference.frequency}× pro Woche trainieren
              {freq && <span className={`ml-2 font-medium ${freq.tone}`}>{freq.label}</span>}
              {sync && <span className={`ml-2 font-medium ${sync.tone}`}>{sync.label}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted">Noch keine Verfügbarkeit angegeben.</p>
          )}
          {effectiveWeek.source !== "NONE" ? (
            <p className="text-sm">
              {WEEKDAY_LABELS.map((label, d) => (
                <span key={d} className="mr-3">
                  <span className="text-muted">{label}: </span>
                  <span className={planByWeekday.has(d) ? "font-medium text-accent" : "text-muted"}>
                    {planByWeekday.get(d) ?? "–"}
                  </span>
                </span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-muted">Noch kein Wochenprogramm zugeteilt.</p>
          )}
        </div>

        {/* Kennzahlen */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Trainings" value={String(stats.count)} />
          <Stat label="Ø Motivation" value={`${stats.avgMotivation}`} suffix="/20" />
          <Stat label="Ø Anstrengung" value={`${stats.avgExertion}`} suffix="/20" />
          <Stat label="Volumen ges." value={stats.totalVolume.toLocaleString("de-DE")} suffix=" kg" />
        </div>

        {stats.sessions.length > 0 && (
          <>
            <div className="card mb-6">
              <h2 className="mb-1 text-lg font-semibold">Trainingsvolumen</h2>
              <p className="mb-3 text-xs text-muted">
                Summe Gewicht × Wdh. pro Einheit (kg), über alle Pläne
              </p>
              <LineChart
                labels={labels}
                series={[
                  {
                    name: "Volumen",
                    color: "var(--accent)",
                    values: stats.sessions.map((s) => s.totalVolume),
                  },
                ]}
              />
            </div>

            <div className="card mb-6">
              <h2 className="mb-1 text-lg font-semibold">Motivation & Anstrengung</h2>
              <p className="mb-3 text-xs text-muted">Skala 1–20, über alle Pläne</p>
              <LineChart
                labels={labels}
                series={[
                  {
                    name: "Motivation",
                    color: "var(--accent)",
                    values: stats.sessions.map((s) => s.motivation),
                  },
                  {
                    name: "Anstrengung",
                    color: "var(--warn)",
                    values: stats.sessions.map((s) => s.exertion),
                  },
                ]}
              />
            </div>
          </>
        )}

        {/* Pläne & Programme */}
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Pläne & Programme</h2>

          <div className="flex flex-wrap items-center gap-1.5">
            {client.programs.map((pr) => (
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
            {client.plans.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <form action={assignPlan}>
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
                <Link
                  href={`/t/${p.shareToken}/history`}
                  className="text-xs text-muted hover:text-accent"
                >
                  Verlauf
                </Link>
              </span>
            ))}
            {client.plans.length === 0 && client.programs.length === 0 && (
              <span className="text-xs text-muted">
                Noch kein Plan oder Programm zugewiesen.
              </span>
            )}
          </div>

          {allPrograms.length > 0 && (
            <form action={assignProgram} className="flex gap-2">
              <input type="hidden" name="accountId" value={client.id} />
              <select name="programId" className="input flex-1" required>
                <option value="">Programm zuweisen…</option>
                {allPrograms.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    📋 {pr.name}
                    {pr.assignedTo ? ` (bei ${pr.assignedTo.displayName})` : ""}
                  </option>
                ))}
              </select>
              <button className="btn-ghost" type="submit">
                Zuweisen
              </button>
            </form>
          )}

          <form action={assignPlan} className="flex gap-2">
            <input type="hidden" name="accountId" value={client.id} />
            <select name="planId" className="input flex-1" required>
              <option value="">Plan auswählen…</option>
              {allPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.assignedTo ? ` (bei ${p.assignedTo.displayName})` : ""}
                </option>
              ))}
            </select>
            <button className="btn-ghost" type="submit">
              Zuweisen
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card-2">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">
        {value}
        {suffix && <span className="text-sm font-medium text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
