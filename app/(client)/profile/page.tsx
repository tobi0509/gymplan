import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccount, ROLE } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { parseWeekdays } from "@/lib/schedule";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import PreferenceCard from "./PreferenceCard";

export const dynamic = "force-dynamic";

// "Profil"-Tab: Trainingsrhythmus, Passwort, Abmelden.
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { err?: string };
}) {
  const account = await requireAccount();
  if (account.role === ROLE.TRAINER) redirect("/");

  const [preference, totalSessions] = await Promise.all([
    prisma.trainingPreference.findUnique({
      where: { accountId: account.id },
    }),
    prisma.workoutSession.count({
      where: { clientName: account.displayName, status: "COMPLETED" },
    }),
  ]);

  const weekdays = preference ? parseWeekdays(preference.weekdays) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-muted">
          GymPlan
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          {account.displayName}
        </h1>
        <p className="text-muted">{totalSessions} abgeschlossene Trainings</p>
      </div>

      {/* Trainingsrhythmus: ohne Präferenz prominent, sonst eingeklappt */}
      <div className="mb-6">
        <PreferenceCard
          initialWeekdays={weekdays}
          initialFrequency={preference?.frequency ?? null}
          collapsed={preference != null && searchParams.err !== "days"}
          error={searchParams.err}
        />
      </div>

      <div className="mb-6">
        <ChangePasswordForm />
      </div>

      <form action={logout}>
        <button className="btn-ghost w-full" type="submit">
          Abmelden
        </button>
      </form>
    </main>
  );
}
