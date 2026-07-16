import { getAccount, ROLE } from "@/lib/auth";
import ClientTabBar from "@/components/nav/ClientTabBar";

// Kunden sehen auf den Plan-Seiten die mobile Tab-Bar (in der Workout-Session
// blendet sie sich selbst aus). Trainer navigieren hier ohne Tab-Bar.
// getAccount ist per react cache() request-gecacht — keine Extra-Query.
export default async function ShareTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getAccount();
  return (
    <>
      {children}
      {account?.role === ROLE.CLIENT && <ClientTabBar />}
    </>
  );
}
