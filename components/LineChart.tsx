"use client";

// Minimalistisches Mehrfach-Linien-Diagramm (Whoop-Stil), reines SVG.
export type Series = {
  name: string;
  color: string; // CSS-Farbe
  values: (number | null)[];
};

export default function LineChart({
  labels,
  series,
  height = 180,
  ySuffix = "",
}: {
  labels: string[];
  series: Series[];
  height?: number;
  ySuffix?: string;
}) {
  const W = 520;
  const H = height;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const n = labels.length;
  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const maxV = allVals.length ? Math.max(...allVals) : 1;
  const minV = 0;
  const range = maxV - minV || 1;

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  // Y-Gitter (3 Linien)
  const ticks = [0, 0.5, 1].map((t) => minV + t * range);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]">
        {/* Gitter + Y-Achse */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--muted)"
            >
              {Math.round(t)}
              {ySuffix}
            </text>
          </g>
        ))}

        {/* X-Labels */}
        {labels.map((lab, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted)"
          >
            {lab}
          </text>
        ))}

        {/* Linien */}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => (v == null ? null : { x: x(i), y: y(v) }))
            .filter((p): p is { x: number; y: number } => p != null);
          if (!pts.length) return null;
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legende */}
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
