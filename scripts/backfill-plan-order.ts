// Einmaliges, idempotentes Backfill: übernimmt Reihenfolge/Zuweisung aus den
// abzulösenden Modellen (ProgramDay, StandardWeekEntry) in Plan.order /
// Plan.assignedToId, bevor diese Modelle in einer Folgemigration entfernt
// werden. Überschreibt nie eine bestehende Plan.assignedToId (nur wenn NULL).
// Idempotent: ein Plan, dessen order bereits != 0 ist, wird übersprungen.
//
// Ausführen mit: npx tsx scripts/backfill-plan-order.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Programm-abgeleitete Zuweisungen zuerst (explizite Trainer-Reihenfolge),
  // je Kunde nach Program.createdAt sortiert (ältestes Programm zuerst), dann
  // nach ProgramDay.order — damit bei mehreren Programmen desselben Kunden
  // eine stabile, nachvollziehbare Gesamtreihenfolge entsteht.
  const programDays = await prisma.programDay.findMany({
    include: {
      program: { select: { assignedToId: true, createdAt: true, name: true } },
      plan: { select: { id: true, assignedToId: true, order: true, name: true } },
    },
  });

  type Pending = { planId: string; planName: string; sortKey: [number, number] };
  const byAccount = new Map<string, Pending[]>();

  for (const pd of programDays) {
    const accountId = pd.program.assignedToId;
    if (!accountId) continue; // unzugewiesenes Programm -> kein Ziel-Kunde
    if (pd.plan.assignedToId != null) continue; // bestehende Zuweisung nie überschreiben
    const list = byAccount.get(accountId) ?? [];
    list.push({
      planId: pd.plan.id,
      planName: pd.plan.name,
      sortKey: [pd.program.createdAt.getTime(), pd.order],
    });
    byAccount.set(accountId, list);
  }

  // StandardWeek-abgeleitete Zuweisungen danach (sortiert nach Wochentag),
  // nur für Kunden/Pläne, die nicht schon über ein Programm behandelt wurden.
  const standardEntries = await prisma.standardWeekEntry.findMany({
    include: {
      week: { select: { accountId: true } },
      plan: { select: { id: true, assignedToId: true, order: true, name: true } },
    },
    orderBy: [{ weekday: "asc" }, { position: "asc" }],
  });

  for (const e of standardEntries) {
    const accountId = e.week.accountId;
    if (e.plan.assignedToId != null) continue;
    const list = byAccount.get(accountId) ?? [];
    if (list.some((p) => p.planId === e.plan.id)) continue; // schon (via Programm) erfasst
    list.push({
      planId: e.plan.id,
      planName: e.plan.name,
      // Programm-Einträge sortieren per Definition vor StandardWeek-Einträgen:
      // Zeitstempel weit in der Zukunft als Tie-Breaker reicht hier nicht,
      // daher separate Sortiergruppe unten statt gemeinsamem numerischen Key.
      sortKey: [Number.MAX_SAFE_INTEGER, e.weekday],
    });
    byAccount.set(accountId, list);
  }

  let totalWrites = 0;
  let totalSkipped = 0;

  for (const [accountId, pending] of Array.from(byAccount)) {
    pending.sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]);

    const existingMax = await prisma.plan.aggregate({
      where: { assignedToId: accountId },
      _max: { order: true },
    });
    let nextOrder = (existingMax._max.order ?? -1) + 1;

    for (const p of pending) {
      const current = await prisma.plan.findUnique({
        where: { id: p.planId },
        select: { order: true, assignedToId: true },
      });
      if (!current) continue;
      if (current.assignedToId != null) {
        totalSkipped++;
        continue; // in der Zwischenzeit anderweitig zugewiesen worden
      }
      if (current.order !== 0) {
        totalSkipped++;
        continue; // bereits von einem früheren Lauf befüllt (Idempotenz)
      }
      await prisma.plan.update({
        where: { id: p.planId },
        data: { assignedToId: accountId, order: nextOrder },
      });
      console.log(
        `Backfill: Plan "${p.planName}" (${p.planId}) -> Kunde ${accountId}, order=${nextOrder}`,
      );
      nextOrder++;
      totalWrites++;
    }
  }

  console.log(`Backfill fertig: ${totalWrites} Pläne aktualisiert, ${totalSkipped} übersprungen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
