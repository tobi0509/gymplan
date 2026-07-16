"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export type TabItem = {
  href: string;
  label: string;
  icon: IconName;
  // Zusätzliche Pfad-Präfixe, bei denen der Tab als aktiv gilt
  // (z.B. /plans/[id] → Tab "Pläne"). "/" matcht nur exakt.
  activePrefixes?: string[];
};

// Mobile Bottom-Tab-Bar (unter md ausgeblendet der Rest, ab md unsichtbar).
// withSpacer: hält den Platz unter dem Content frei — wirkt nur, wenn die
// Bar NACH dem Seiteninhalt gerendert wird (Kunden-Layouts). Steht die Bar
// davor (TrainerNav), stattdessen .pb-tabbar auf dem <main> verwenden.
export default function TabBar({
  items,
  withSpacer = true,
}: {
  items: TabItem[];
  withSpacer?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (item: TabItem) => {
    const hrefMatch =
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      hrefMatch ||
      (item.activePrefixes ?? []).some((p) => pathname.startsWith(p))
    );
  };

  return (
    <>
      {withSpacer && <div aria-hidden className="h-16 pb-safe md:hidden" />}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-base/90 pb-safe backdrop-blur md:hidden"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
        >
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6" />
                <span className="text-[10px] font-medium tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
