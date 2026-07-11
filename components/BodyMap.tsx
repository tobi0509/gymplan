// Schematische Muskel-Ansicht (Front + Back).
// Erwartet `data` gekeyed nach svgKey -> { pct, label }.
// Einfärbung: 0 % = matt, dann Verlauf ins Akzent-Grün, 100 % = Glow (Whoop-Stil).

export type BodyData = Record<string, { pct: number; label: string }>;

function fill(pct: number): { fillOpacity: number; filter?: string } {
  if (pct <= 0) return { fillOpacity: 0 };
  const o = 0.22 + 0.78 * Math.min(1, pct / 100);
  return {
    fillOpacity: o,
    filter: pct >= 100 ? "url(#glow)" : undefined,
  };
}

// Ein Muskel = eine oder mehrere Shapes, die alle denselben svgKey teilen.
type Shape =
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "rrect"; x: number; y: number; w: number; h: number; r: number };

const FRONT: Record<string, Shape[]> = {
  shoulders: [
    { t: "ellipse", cx: 60, cy: 96, rx: 19, ry: 15 },
    { t: "ellipse", cx: 140, cy: 96, rx: 19, ry: 15 },
  ],
  chest: [
    { t: "rrect", x: 63, y: 104, w: 33, h: 40, r: 12 },
    { t: "rrect", x: 104, y: 104, w: 33, h: 40, r: 12 },
  ],
  biceps: [
    { t: "ellipse", cx: 48, cy: 150, rx: 11, ry: 25 },
    { t: "ellipse", cx: 152, cy: 150, rx: 11, ry: 25 },
  ],
  forearms: [
    { t: "ellipse", cx: 42, cy: 206, rx: 9, ry: 28 },
    { t: "ellipse", cx: 158, cy: 206, rx: 9, ry: 28 },
  ],
  abs: [{ t: "rrect", x: 83, y: 150, w: 34, h: 66, r: 12 }],
  quads: [
    { t: "ellipse", cx: 83, cy: 292, rx: 20, ry: 47 },
    { t: "ellipse", cx: 117, cy: 292, rx: 20, ry: 47 },
  ],
};

const BACK: Record<string, Shape[]> = {
  traps: [{ t: "rrect", x: 70, y: 98, w: 60, h: 30, r: 14 }],
  lats: [
    { t: "rrect", x: 63, y: 130, w: 33, h: 52, r: 14 },
    { t: "rrect", x: 104, y: 130, w: 33, h: 52, r: 14 },
  ],
  lower_back: [{ t: "rrect", x: 82, y: 184, w: 36, h: 30, r: 12 }],
  triceps: [
    { t: "ellipse", cx: 48, cy: 150, rx: 11, ry: 25 },
    { t: "ellipse", cx: 152, cy: 150, rx: 11, ry: 25 },
  ],
  glutes: [
    { t: "ellipse", cx: 85, cy: 238, rx: 18, ry: 22 },
    { t: "ellipse", cx: 115, cy: 238, rx: 18, ry: 22 },
  ],
  hamstrings: [
    { t: "ellipse", cx: 84, cy: 302, rx: 19, ry: 42 },
    { t: "ellipse", cx: 116, cy: 302, rx: 19, ry: 42 },
  ],
  calves: [
    { t: "ellipse", cx: 84, cy: 378, rx: 13, ry: 33 },
    { t: "ellipse", cx: 116, cy: 378, rx: 13, ry: 33 },
  ],
};

function renderShape(s: Shape, key: string) {
  if (s.t === "ellipse")
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
  return (
    <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} ry={s.r} />
  );
}

function Figure({
  map,
  data,
  title,
}: {
  map: Record<string, Shape[]>;
  data: BodyData;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 440" className="h-full w-full max-h-[460px]">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint silhouette: head + joints for context */}
        <g fill="var(--surface-2)">
          <circle cx="100" cy="34" r="20" />
          <rect x="92" y="52" width="16" height="14" rx="6" />
          {/* hands / feet hints */}
          <circle cx="40" cy="240" r="8" />
          <circle cx="160" cy="240" r="8" />
          <ellipse cx="84" cy="424" rx="12" ry="8" />
          <ellipse cx="116" cy="424" rx="12" ry="8" />
        </g>

        {/* Base muscle shapes (unfilled/dim) */}
        <g fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1">
          {Object.entries(map).flatMap(([svgKey, shapes]) =>
            shapes.map((s, i) => renderShape(s, `base-${svgKey}-${i}`)),
          )}
        </g>

        {/* Coverage overlay */}
        <g fill="var(--accent)">
          {Object.entries(map).flatMap(([svgKey, shapes]) => {
            const d = data[svgKey];
            const f = fill(d?.pct ?? 0);
            return shapes.map((s, i) => (
              <g
                key={`ov-${svgKey}-${i}`}
                fillOpacity={f.fillOpacity}
                filter={f.filter}
              >
                {renderShape(s, `ovs-${svgKey}-${i}`)}
                <title>
                  {d ? `${d.label}: ${Math.round(d.pct)} %` : svgKey}
                </title>
              </g>
            ));
          })}
        </g>
      </svg>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </span>
    </div>
  );
}

export default function BodyMap({ data }: { data: BodyData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Figure map={FRONT} data={data} title="Vorderseite" />
      <Figure map={BACK} data={data} title="Rückseite" />
    </div>
  );
}

// Für Trainer/Client-Seiten: baut BodyData aus Muskel-Liste + Coverage.
export function toBodyData(
  muscles: { id: string; name: string; svgKey: string }[],
  coverage: Record<string, { coveragePct: number }>,
): BodyData {
  const out: BodyData = {};
  for (const m of muscles) {
    out[m.svgKey] = {
      pct: coverage[m.id]?.coveragePct ?? 0,
      label: m.name,
    };
  }
  return out;
}
