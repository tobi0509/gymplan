import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import LineChart from "@/components/LineChart";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { addDays, startOfWeek } from "@/lib/schedule";
import { activityStatus, frequencyStatus, getClientTrainingStats } from "@/lib/clientStatus";
import { deleteClientAccount } from "../actions";
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
      trainingPreference: true,
    },
  });
  if (!client || client.role !== ROLE.CLIENT) notFound();

  const host = headers().get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const loginUrl = host ? `${proto}://${host}/login` : "/login";

  const currentWeekStart = startOfWeek(new Date());
  const [lastSession, weekSessionCount, stats, plans] = await Promise.all([
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
      where: { assignedToId: client.id },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { exercises: true } },
        sessions: { where: { status: "COMPLETED" }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  const act = activityStatus(lastSession._max.startedAt);
  const freq = client.trainingPreference
    ? frequencyStatus(client.trainingPreference.frequency, weekSessionCount)
    : null;

  const labels = stats.sessions.map((s) => shortDate(s.date));

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-tabbar md:py-8">
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
          <Link href={`/clients/${client.id}/plans`} className="btn-ghost">
            Trainings bearbeiten
          </Link>
          <Link href={`/clients/${client.id}/history`} className="btn-ghost">
            Trainingsverlauf
          </Link>
          <form action={deleteClientAccount}>
            <input type="hidden" name="id" value={client.id} />
            <button className="btn-ghost text-danger" type="submit">
              Zugang löschen
            </button>
          </form>
        </div>

        {/* Verfügbarkeit */}
        {client.trainingPreference && (
          <div className="card mb-6 space-y-2">
            <h2 className="text-lg font-semibold">Verfügbarkeit</h2>
            <p className="text-sm text-muted">
              Möchte {client.trainingPreference.frequency}× pro Woche trainieren
              {freq && <span className={`ml-2 font-medium ${freq.tone}`}>{freq.label}</span>}
            </p>
          </div>
        )}

        {/* Trainings */}
        <div className="card mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trainings</h2>
            <Link href={`/clients/${client.id}/plans`} className="text-sm text-accent hover:underline">
              Bearbeiten →
            </Link>
          </div>
          {plans.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Trainings zugewiesen.</p>
          ) : (
            <ol className="space-y-1.5">
              {plans.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                    {p.name}
                    <span className="ml-2 text-xs text-muted">
                      {p._count.exercises} Übungen
                    </span>
                  </span>
                  {p.sessions.length > 0 && <span className="chip text-accent">✓</span>}
                </li>
              ))}
            </ol>
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
