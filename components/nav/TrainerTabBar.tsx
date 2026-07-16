"use client";

import TabBar, { type TabItem } from "./TabBar";

const TRAINER_TABS: TabItem[] = [
  { href: "/", label: "Pläne", icon: "dumbbell", activePrefixes: ["/plans"] },
  { href: "/programs", label: "Programme", icon: "layers" },
  { href: "/exercises", label: "Übungen", icon: "list" },
  { href: "/clients", label: "Kunden", icon: "users" },
];

// Spacer aus: TrainerNav steht VOR dem <main>, das Freihalten übernimmt
// die .pb-tabbar-Klasse auf den Trainer-Seiten.
export default function TrainerTabBar() {
  return <TabBar items={TRAINER_TABS} withSpacer={false} />;
}
