"use client";

import { usePathname } from "next/navigation";
import TabBar, { type TabItem } from "./TabBar";

const CLIENT_TABS: TabItem[] = [
  // Plan-Vorschau/Verlauf (/t/…) gehören gefühlt zu "Heute"
  { href: "/me", label: "Heute", icon: "home", activePrefixes: ["/t/"] },
  { href: "/progress", label: "Fortschritt", icon: "chart" },
  { href: "/profile", label: "Profil", icon: "user" },
];

export default function ClientTabBar() {
  const pathname = usePathname();
  // Fokus-Modus: während des Workouts keine Tab-Bar (und kein Spacer)
  if (/^\/t\/[^/]+\/session/.test(pathname)) return null;
  return <TabBar items={CLIENT_TABS} />;
}
