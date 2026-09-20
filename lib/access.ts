// Zentrale Zugriffsprüfung für Pläne: Trainer immer, Kunde nur bei
// direkter Zuweisung (jedes Training gehört fix zu genau einem Kunden).
import { ROLE } from "@/lib/auth";
import type { Account, Plan } from "@prisma/client";

export async function mayAccessPlan(
  account: Account,
  plan: Pick<Plan, "id" | "assignedToId">,
): Promise<boolean> {
  if (account.role !== ROLE.CLIENT) return true;
  return plan.assignedToId === account.id;
}
