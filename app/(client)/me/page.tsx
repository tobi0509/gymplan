import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import {
  startOfWeek,
  localDateKey,
  addDays,
  parseWeekdays,
  WEEKDAY_LABELS,
} from "@/lib/schedule";
import { getEffectiveWeek } from "@/lib/week";
import WeekStrip, { type StripDay } from "./WeekStrip";

export const dynamic = "force-dynamic";

function dayLabel(key: Date, opts?: Intl.DateTimeFormatOptions) {
  return key.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC", // key trägt das lokale Datum in UTC-Komponenten
    ...opts,
  });
}

// "Heute"-Tab: Trainingswoche + Pläne. Rhythmus/Passwort/Abmelden liegen im
// Profil-Tab, die Statistik im Fortschritt-Tab.
export default async function MePage() {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const now = new Date();
  const today = localDateKey(now);
  const currentWeekStart = startOfWeek(now);

  const [preference, week, plans] = await Promise.all([
    prisma.trainingPreference.findUnique({
      where: { accountId: account.id },
    }),
    getEffectiveWeek(account.id, currentWeekStart),
    prisma.plan.findMany({
      where: { assignedToId: account.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { exercises: true } } },
    }),
  ]);

  // Sessions der angezeigten Woche für die Erledigt-Häkchen
  const mondayLocal = new Date(
    currentWeekStart.getUTCFullYear(),
    currentWeekStart.getUTCMonth(),
    currentWeekStart.getUTCDate(),
  );
  const nextMondayLocal = new Date(mondayLocal);
  nextMondayLocal.setDate(nextMondayLocal.getDate() + 7);
  const weekSessions =
    week.entries.length > 0
      ? await prisma.workoutSession.findMany({
          where: {
            clientName: account.displayName,
            status: "COMPLETED",
            startedAt: { gte: mondayLocal, lt: nextMondayLocal },
          },
          select: { planId: true, startedAt: true },
        })
      : [];

  // 7-Tage-Streifen aufbauen
  const stripDays: StripDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(currentWeekStart, i);
    const entries = week.entries
      .filter((e) => e.date.getTime() === key.getTime())
      .map((e) => ({
        id: e.key,
        planName: e.plan.name,
        shareToken: e.plan.shareToken,
        done: weekSessions.some(
          (s) =>
            s.planId === e.planId &&
            localDateKey(s.startedAt).getTime() === key.getTime(),
        ),
      }));
    return {
      key: key.toISOString(),
      label: dayLabel(key),
      isToday: key.getTime() === today.getTime(),
      entries,
    };
  });

  const totalSessions = await prisma.workoutSession.count({
    where: { clientName: account.displayName, status: "COMPLETED" },
  });

  const weekdays = preference ? parseWeekdays(preference.weekdays) : [];
  const waitingForTrainer = preference != null && week.source === "NONE";

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

      {/* Trainingswoche (sobald der Trainer zugeteilt hat) */}
      {week.entries.length > 0 && (
        <section className="mb-6">
          <WeekStrip
            days={stripDays}
            hint={
              week.source === "OVERRIDE" ? "Diese Woche angepasst" : undefined
            }
          />
        </section>
      )}
      {week.source === "OVERRIDE" && week.entries.length === 0 && (
        <section className="card mb-6 text-muted">
          Diese Woche ist trainingsfrei. 🏖️
        </section>
      )}
      {week.source === "STANDARD" && week.entries.length === 0 && (
        <section className="card mb-6 text-muted">
          Dein Trainer hat aktuell keine Trainingstage eingeplant.
        </section>
      )}

      {/* Warte-Status: Rhythmus gespeichert, Trainer hat noch nicht zugeteilt */}
      {waitingForTrainer && (
        <section className="card mb-6 border-accent/40">
          <div className="text-lg font-semibold">
            Dein Trainer stellt gerade dein Wochenprogramm zusammen 💪
          </div>
          <p className="mt-1 text-sm text-muted">
            Sobald es fertig ist, siehst du hier deine Trainingswoche.
            {weekdays.length > 0 && (
              <>
                {" "}
                Deine Zeiten:{" "}
                {weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}.
              </>
            )}
          </p>
        </section>
      )}

      {/* Onboarding: noch kein Trainingsrhythmus hinterlegt */}
      {preference == null && (
        <section className="card mb-6 border-accent/40">
          <div className="text-lg font-semibold">Willkommen! 👋</div>
          <p className="mt-1 text-sm text-muted">
            Lege zuerst deinen Trainingsrhythmus fest — dein Trainer stellt dir
            daraus dein Wochenprogramm zusammen.
          </p>
          <Link href="/profile" className="btn-primary mt-3 w-full">
            Trainingsrhythmus festlegen
          </Link>
        </section>
      )}

      {/* Einzeln zugewiesene Pläne */}
      {plans.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold">Deine Trainingspläne</h2>
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
      )}
    </main>
  );
}
