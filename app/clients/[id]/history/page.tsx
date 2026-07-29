import Link from "next/link";
import { notFound } from "next/navigation";
import TrainerNav from "@/components/TrainerNav";
import { prisma } from "@/lib/prisma";
import { requireTrainer, ROLE } from "@/lib/auth";
import { getClientHistory, getExerciseOptions } from "@/lib/clientStatus";
import ClientHistoryClient from "./ClientHistoryClient";

export const dynamic = "force-dynamic";

export default async function ClientHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requireTrainer();
  const client = await prisma.account.findUnique({ where: { id: params.id } });
  if (!client || client.role !== ROLE.CLIENT) notFound();

  const [sessions, exerciseOptions] = await Promise.all([
    getClientHistory(client.displayName),
    getExerciseOptions(client.displayName),
  ]);

  return (
    <>
      <TrainerNav />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-tabbar md:py-8">
        <div className="mb-6">
          <Link href={`/clients/${client.id}`} className="text-sm text-muted hover:text-foreground">
            ← {client.displayName}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Trainingsverlauf</h1>
        </div>

        <ClientHistoryClient
          accountId={client.id}
          sessions={sessions}
          exerciseOptions={exerciseOptions}
        />
      </main>
    </>
  );
}
