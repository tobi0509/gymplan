import Link from "next/link";

export type StripEntry = {
  id: string;
  planName: string;
  shareToken: string;
  done: boolean;
};
export type StripDay = {
  key: string; // ISO des Tages
  label: string; // z.B. "Mo 14.07."
  isToday: boolean;
  entries: StripEntry[];
};

// 7-Tage-Übersicht der geplanten Trainingswoche (Mo–So).
export default function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <div className="card space-y-1.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deine Trainingswoche</h2>
        <Link href="/me?plan=1" className="btn-ghost text-sm">
          Neu planen
        </Link>
      </div>
      {days.map((d) => (
        <div
          key={d.key}
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
            d.isToday ? "bg-surface-2 ring-1 ring-accent" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-20 shrink-0 text-sm tabular-nums ${
                d.isToday ? "font-semibold text-accent" : "text-muted"
              }`}
            >
              {d.label}
            </span>
            {d.isToday && <span className="chip text-accent">Heute</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {d.entries.length === 0 && (
              <span className="text-sm text-muted">Frei</span>
            )}
            {d.entries.map((e) => (
              <span key={e.id} className="flex items-center gap-1">
                <Link
                  href={`/t/${e.shareToken}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {e.planName}
                </Link>
                {e.done && <span className="chip text-accent">✓</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
