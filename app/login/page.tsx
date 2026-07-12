import { redirect } from "next/navigation";
import { getAccount, ROLE } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const account = await getAccount();
  if (account) redirect(account.role === ROLE.TRAINER ? "/" : "/me");

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-2xl font-black text-black">
            G
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">GymPlan</h1>
          <p className="text-sm text-muted">
            Melde dich mit deinem Zugang an.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
