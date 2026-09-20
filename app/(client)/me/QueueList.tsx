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
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                  it.done ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {it.done ? "✓" : i + 1}
              </span>
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-muted">
                  {it.exerciseCount} Übungen
                  {isNextUp && <span className="ml-2 chip text-accent">Als Nächstes</span>}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/t/${it.shareToken}/history`}
                className="text-sm text-muted hover:text-accent"
              >
                Verlauf
              </Link>
              <Link
                href={`/t/${it.shareToken}`}
                className={isNextUp ? "btn-primary" : "btn-ghost"}
              >
                Trainieren
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
