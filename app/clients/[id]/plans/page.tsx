import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import PlanQueueClient, { type QueueEntry } from "./PlanQueueClient";

export const dynamic = "force-dynamic";

export default async function ClientPlansPage({
  params,
}: {
  params: { id: string };
}) {
  await requireTrainer();
  const client = await prisma.account.findUnique({
    where: { id: params.id },
    select: { id: true, displayName: true },
  });
  if (!client) notFound();
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account || account.role !== ROLE.CLIENT) notFound();

  const plans = await prisma.plan.findMany({
    where: { assignedToId: client.id },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { exercises: true } },
      sessions: {
        where: { status: "COMPLETED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const entries: QueueEntry[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    exerciseCount: p._count.exercises,
    done: p.sessions.length > 0,
  }));

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-6">
          <Link
            href={`/clients/${client.id}`}
            className="text-sm text-muted hover:text-foreground"
          >
            ← {client.displayName}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Trainings: {client.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Reihenfolge, in der der Kunde die Trainings abarbeiten soll.
          </p>
        </div>

        <PlanQueueClient accountId={client.id} initialItems={entries} />
      </main>
    </>
  );
}
