import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import {
  addDays,
  parseWeekdays,
  startOfWeek,
  WEEKDAY_LABELS,
} from "@/lib/schedule";
import WeekEditor, { type PlanOption } from "./WeekEditor";

export const dynamic = "force-dynamic";

function dayDate(weekStart: Date, weekday: number) {
  const d = addDays(weekStart, weekday);
  return `${WEEKDAY_LABELS[weekday]} ${d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  })}`;
}

function rangeLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return `${fmt(weekStart)}–${fmt(end)}`;
}

export default async function ClientWeekPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { woche?: string; gespeichert?: string };
}) {
  await requireTrainer();
  const client = await prisma.account.findUnique({
    where: { id: params.id },
    include: {
      trainingPreference: true,
      standardWeek: { include: { entries: true } },
    },
  });
  if (!client || client.role !== ROLE.CLIENT) notFound();

  const tab =
    searchParams.woche === "diese" || searchParams.woche === "naechste"
      ? searchParams.woche
      : "standard";
  const saved = searchParams.gespeichert === "1";

  const thisWeekStart = startOfWeek(new Date());
  const nextWeekStart = addDays(thisWeekStart, 7);
  const weekStart = tab === "naechste" ? nextWeekStart : thisWeekStart;

  // Pläne fürs Dropdown: dem Kunden zugewiesene zuerst, dann alle anderen
  const allPlans = await prisma.plan.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, assignedToId: true },
  });
  const plans: PlanOption[] = [
    ...allPlans.filter((p) => p.assignedToId === client.id),
    ...allPlans.filter((p) => p.assignedToId !== client.id),
  ].map((p) => ({ id: p.id, name: p.name }));

  // Vorbelegung: Standardwoche bzw. Wochen-Ausnahme (falls vorhanden),
  // Wochen-Tabs ohne Ausnahme werden aus der Standardwoche vorbefüllt.
  const standardByDay: (string | null)[] = Array(7).fill(null);
  for (const e of client.standardWeek?.entries ?? []) {
    if (e.position === 0) standardByDay[e.weekday] = e.planId;
  }

  let initialPlanByDay = standardByDay;
  let overrideExists = false;
  if (tab !== "standard") {
    const override = await prisma.weeklySchedule.findUnique({
      where: {
        accountId_weekStart: { accountId: client.id, weekStart },
      },
      include: { entries: true },
    });
    if (override) {
      overrideExists = true;
      const byDay: (string | null)[] = Array(7).fill(null);
      for (const e of override.entries) {
        const weekday = Math.round(
          (e.date.getTime() - weekStart.getTime()) / 86400000,
        );
        if (e.position === 0 && weekday >= 0 && weekday <= 6) {
          byDay[weekday] = e.planId;
        }
      }
      initialPlanByDay = byDay;
    }
  }

  const preference = client.trainingPreference;
  const weekdays = preference ? parseWeekdays(preference.weekdays) : [];

  const tabs = [
    { slug: "standard", label: "Standardwoche" },
    { slug: "diese", label: `Diese Woche (${rangeLabel(thisWeekStart)})` },
    { slug: "naechste", label: `Nächste Woche (${rangeLabel(nextWeekStart)})` },
  ] as const;

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link href="/clients" className="text-sm text-muted hover:text-foreground">
            ← Kunden
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Wochenprogramm: {client.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {preference
              ? `Möchte ${preference.frequency}× pro Woche trainieren · Zeit am: ${
                  weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ") || "–"
                }`
              : "Hat noch keine Verfügbarkeit angegeben."}
          </p>
        </div>

        {/* Tab-Auswahl */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.slug}
              href={`/clients/${client.id}/week${
                t.slug === "standard" ? "" : `?woche=${t.slug}`
              }`}
              className={`chip ${tab === t.slug ? "pill-active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="card">
          {tab === "standard" ? (
            <p className="mb-4 text-sm text-muted">
              Die Standardwoche gilt jede Woche automatisch, bis du sie änderst.
            </p>
          ) : (
            <p className="mb-4 text-sm text-muted">
              Änderungen hier gelten nur für diese eine Woche — die
              Standardwoche bleibt unverändert.
            </p>
          )}
          <WeekEditor
            key={`${tab}-${overrideExists}`}
            accountId={client.id}
            mode={tab === "standard" ? "standard" : "week"}
            weekStartIso={tab === "standard" ? undefined : weekStart.toISOString()}
            woche={tab === "standard" ? undefined : tab}
            dayDates={
              tab === "standard"
                ? undefined
                : Array.from({ length: 7 }, (_, d) => dayDate(weekStart, d))
            }
            initialPlanByDay={initialPlanByDay}
            plans={plans}
            availableWeekdays={weekdays}
            frequency={preference?.frequency ?? null}
            overrideExists={overrideExists}
            saved={saved}
          />
        </div>
      </main>
    </>
  );
}
