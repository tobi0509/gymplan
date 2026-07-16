import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import { mayAccessPlan } from "@/lib/access";
import { getHistory } from "../actions";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: { shareToken: string };
}) {
  const account = await requireAccount();
  const plan = await prisma.plan.findUnique({
    where: { shareToken: params.shareToken },
    select: { id: true, name: true, ownerName: true, assignedToId: true },
  });
  if (!plan) notFound();
  if (!(await mayAccessPlan(account, plan))) notFound();

  const { clientName, sessions } = await getHistory(params.shareToken);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/t/${params.shareToken}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Zurück zum Plan
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          {account.role === ROLE.TRAINER && clientName !== account.displayName
            ? `Verlauf von ${clientName}`
            : "Dein Verlauf"}
        </h1>
        <p className="text-muted">{plan.name}</p>
      </div>
      <HistoryClient
        shareToken={params.shareToken}
        clientName={clientName}
        sessions={sessions}
      />
    </main>
  );
}
