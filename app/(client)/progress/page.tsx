import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount, ROLE } from "@/lib/auth";
import { getClientTrainingStats } from "@/lib/clientStatus";
import LineChart from "@/components/LineChart";

export const dynamic = "force-dynamic";

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

// "Fortschritt"-Tab: Statistik über alle Pläne hinweg + letzte Trainings.
export default async function ProgressPage() {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const stats = await getClientTrainingStats(account.displayName);
  const labels = stats.sessions.map((s) => shortDate(s.date));
  const recent = [...stats.sessions].reverse().slice(0, 10);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-muted">
          GymPlan
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          Dein Fortschritt
        </h1>
      </div>

      {stats.count === 0 ? (
        <div className="card text-muted">
          Noch keine abgeschlossenen Trainings. Sobald du dein erstes Workout
          abschließt, siehst du hier deine Entwicklung. 💪
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <Stat label="Trainings" value={String(stats.count)} />
            <Stat
              label="Volumen ges."
              value={stats.totalVolume.toLocaleString("de-DE")}
              suffix=" kg"
            />
            <Stat label="Ø Motivation" value={`${stats.avgMotivation}`} suffix="/20" />
            <Stat label="Ø Anstrengung" value={`${stats.avgExertion}`} suffix="/20" />
          </div>

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
            <h2 className="mb-1 text-lg font-semibold">
              Motivation & Anstrengung
            </h2>
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Letzte Trainings</h2>
            {recent.map((s) => (
              <Link
                key={s.id}
                href={`/t/${s.shareToken}/history`}
                className="card flex items-center justify-between hover:border-accent/40"
              >
                <div>
                  <div className="text-sm font-medium">{s.planName}</div>
                  <div className="text-xs text-muted">
                    {new Date(s.date).toLocaleDateString("de-DE", {
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
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
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
