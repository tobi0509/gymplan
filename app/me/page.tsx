import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import {
  startOfWeek,
  getTargetWeekStart,
  localDateKey,
  addDays,
} from "@/lib/schedule";
import { saveWeeklySchedule } from "./actions";
import WeekStrip, { type StripDay } from "./WeekStrip";
import ChangePasswordForm from "@/components/ChangePasswordForm";

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

export default async function MePage({
  searchParams,
}: {
  searchParams: { plan?: string; err?: string };
}) {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const now = new Date();
  const today = localDateKey(now);
  const currentWeekStart = startOfWeek(now);
  const targetWeekStart = getTargetWeekStart(now);

  const [plans, program, currentSchedule, targetScheduleCount, pickableProgramCount] =
    await Promise.all([
      prisma.plan.findMany({
        where: { assignedToId: account.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { exercises: true } } },
      }),
      // Neuestes zugewiesenes Programm bestimmt den Trainingszyklus
      prisma.program.findFirst({
        where: { assignedToId: account.id },
        orderBy: { createdAt: "desc" },
        include: {
          days: {
            orderBy: { order: "asc" },
            include: {
              plan: {
                select: {
                  name: true,
                  shareToken: true,
                  _count: { select: { exercises: true } },
                },
              },
            },
          },
        },
      }),
      prisma.weeklySchedule.findUnique({
        where: {
          accountId_weekStart: {
            accountId: account.id,
            weekStart: currentWeekStart,
          },
        },
        include: {
          program: { select: { name: true } },
          entries: {
            orderBy: [{ date: "asc" }, { position: "asc" }],
            include: { plan: { select: { name: true, shareToken: true } } },
          },
        },
      }),
      prisma.weeklySchedule.count({
        where: { accountId: account.id, weekStart: targetWeekStart },
      }),
      // Wählbare Programme (eigene + Vorlagen) mit mindestens einem Tag
      prisma.program.count({
        where: {
          OR: [{ assignedToId: null }, { assignedToId: account.id }],
          days: { some: {} },
        },
      }),
    ]);

  const hasSchedulableUnits = pickableProgramCount > 0 || plans.length > 0;

  // Sessions der angezeigten Woche für die Erledigt-Häkchen
  const mondayLocal = new Date(
    currentWeekStart.getUTCFullYear(),
    currentWeekStart.getUTCMonth(),
    currentWeekStart.getUTCDate(),
  );
  const nextMondayLocal = new Date(mondayLocal);
  nextMondayLocal.setDate(nextMondayLocal.getDate() + 7);
  const weekSessions = currentSchedule
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
    const entries = (currentSchedule?.entries ?? [])
      .filter((e) => e.date.getTime() === key.getTime())
      .map((e) => ({
        id: e.id,
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

  // Planungs-Banner: Zielwoche noch ungeplant (oder explizit ?plan=1)
  const planningOpen =
    hasSchedulableUnits &&
    (targetScheduleCount === 0 || searchParams.plan === "1");
  const planningNextWeek = targetWeekStart.getTime() !== currentWeekStart.getTime();
  const todayOffset = Math.round(
    (today.getTime() - targetWeekStart.getTime()) / 86400000,
  );
  const selectableOffsets = Array.from({ length: 7 }, (_, i) => i).filter(
    (i) => planningNextWeek || i >= todayOffset,
  );

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

      {/* Wochenplanung */}
      {planningOpen && (
        <section className="card mb-6 space-y-3 border-accent/40">
          <div>
            <h2 className="text-lg font-semibold">
              {planningNextWeek
                ? "Plane deine nächste Woche"
                : "Plane deine Trainingswoche"}
            </h2>
            <p className="text-sm text-muted">
              An welchen Tagen hast du Zeit zu trainieren? Dein Wochenprogramm
              wird automatisch passend zu deiner Häufigkeit gewählt und auf die
              Tage verteilt.
            </p>
          </div>
          <form action={saveWeeklySchedule} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {selectableOffsets.map((i) => {
                const key = addDays(targetWeekStart, i);
                return (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:text-accent"
                  >
                    <input
                      type="checkbox"
                      name="day"
                      value={i}
                      className="accent-[var(--accent)]"
                    />
                    {dayLabel(key, { month: undefined, day: undefined })}{" "}
                    {key.getUTCDate()}.
                  </label>
                );
              })}
            </div>
            {searchParams.err === "days" && (
              <p className="text-sm text-danger">
                Bitte wähle mindestens einen Tag.
              </p>
            )}
            <button className="btn-primary w-full" type="submit">
              Woche planen
            </button>
          </form>
        </section>
      )}

      {/* 7-Tage-Übersicht */}
      {currentSchedule && currentSchedule.entries.length > 0 && (
        <section className="mb-6">
          <WeekStrip
            days={stripDays}
            programName={currentSchedule.program?.name ?? null}
          />
        </section>
      )}

      {/* Programm */}
      {program && program.days.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold">Dein Programm</h2>
          <div className="card space-y-2">
            <div>
              <div className="font-semibold">{program.name}</div>
              <div className="text-xs text-muted">von {program.ownerName}</div>
            </div>
            {program.days.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"
              >
                <div>
                  <span className="chip mr-2 text-accent">Tag {i + 1}</span>
                  <span className="text-sm font-medium">{d.plan.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {d.plan._count.exercises} Übungen
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Link
                    href={`/t/${d.plan.shareToken}/history`}
                    className="btn-ghost px-2.5"
                    aria-label={`Fortschritt ${d.plan.name}`}
                  >
                    📈
                  </Link>
                  <Link href={`/t/${d.plan.shareToken}`} className="btn-ghost">
                    Ansehen
                  </Link>
                </div>
              </div>
            ))}
          </div>
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

      {plans.length === 0 && !program && (
        <section className="mb-6">
          <div className="card text-muted">
            Dir ist noch kein Plan zugewiesen. Dein Trainer schaltet ihn für
            dich frei.
          </div>
        </section>
      )}

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
