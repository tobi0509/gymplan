import Link from "next/link";

export type QueueItem = {
  id: string;
  name: string;
  shareToken: string;
  exerciseCount: number;
  done: boolean;
};

// Geordnete Trainings-Warteschlange: Reihenfolge zeigt die geplante Abfolge,
// erzwingt sie aber nicht — jedes Training ist jederzeit startbar.
export default function QueueList({ items }: { items: QueueItem[] }) {
  const nextUpId = items.find((it) => !it.done)?.id;

  return (
    <div className="card space-y-1.5">
      <h2 className="mb-1 text-lg font-semibold">Deine Trainings</h2>
      {items.map((it, i) => {
        const isNextUp = it.id === nextUpId;
        return (
          <div
            key={it.id}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
              isNextUp ? "bg-surface-2 ring-1 ring-accent" : ""
            } ${it.done ? "opacity-60" : ""}`}
          >
            {/* Name/Zeile → Plan-Vorschau mit Übungsliste */}
            <Link href={`/t/${it.shareToken}`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                  it.done ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {it.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <div className="break-words font-medium">{it.name}</div>
                <div className="text-xs text-muted">
                  {it.exerciseCount} Übungen
                  {isNextUp && <span className="ml-2 chip whitespace-nowrap text-accent">Als Nächstes</span>}
                </div>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/t/${it.shareToken}/history`}
                className="grid h-11 place-items-center rounded-xl px-2 text-sm text-muted hover:text-accent"
              >
                Verlauf
              </Link>
              {/* Direkt ins Training — ohne Umweg über die Vorschau */}
              <Link
                href={
                  it.exerciseCount > 0
                    ? `/t/${it.shareToken}/session`
                    : `/t/${it.shareToken}`
                }
                className={isNextUp ? "btn-primary" : "btn-ghost"}
                aria-label={`${it.name} starten`}
              >
                ▶ Start
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
