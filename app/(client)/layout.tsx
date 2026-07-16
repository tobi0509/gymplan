import ClientTabBar from "@/components/nav/ClientTabBar";

// Kunden-Bereich (/me, /progress, /profile): Inhalt + mobile Bottom-Tab-Bar.
// Auth machen die Seiten selbst (requireAccount + Trainer-Redirect).
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ClientTabBar />
    </>
  );
}
