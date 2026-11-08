"use client";

import { useEffect, useRef, useState } from "react";

// Minimalistisches Mehrfach-Linien-Diagramm (Whoop-Stil), reines SVG.
// Zeichnet in echten Pixeln der Containerbreite (ResizeObserver) — damit sind
// Schriftgrößen am Handy wirklich lesbar statt mitskaliert. Antippen/Hovern
// zeigt die Werte des nächstgelegenen Trainings.
export type Series = {
  name: string;
  color: string; // CSS-Farbe
  values: (number | null)[];
};

const FONT = 11;

function fmtVal(v: number | null, suffix: string) {
  if (v == null) return "–";
  return `${Math.round(v * 10) / 10}`.replace(".", ",") + suffix;
}

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320); // Startwert bis zur ersten Messung
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(200, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const padL = 36;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const n = labels.length;
  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const maxV = allVals.length ? Math.max(...allVals) : 1;
  const minV = 0;
  const range = maxV - minV || 1;

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  // X-Labels ausdünnen: so viele, wie bei ~44 px Abstand passen (letzte immer)
  const maxLabels = Math.max(2, Math.floor(innerW / 44));
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels));
  const showLabel = (i: number) =>
    i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2);

  // Y-Gitter (3 Linien)
  const ticks = [0, 0.5, 1].map((t) => minV + t * range);

  // Nächstgelegenen Datenpunkt zur Finger-/Mausposition finden
  function pickIndex(clientX: number, target: SVGSVGElement) {
    if (n === 0) return;
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - padL) / innerW) * (n - 1));
    setSel(Math.max(0, Math.min(n - 1, i)));
  }

  // Ohne Auswahl die Werte des letzten Trainings zeigen
  const shown = sel ?? (n > 0 ? n - 1 : null);

  return (
    <div ref={wrapRef} className="w-full select-none">
      {shown != null && (
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          <span className="text-muted">{sel == null ? "Zuletzt" : labels[shown]}</span>
          {series.map((s) => (
            <span key={s.name} className="font-semibold tabular-nums" style={{ color: s.color }}>
              {series.length > 1 ? `${s.name} ` : ""}
              {fmtVal(s.values[shown] ?? null, ySuffix)}
            </span>
          ))}
        </div>
      )}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block max-w-full touch-pan-y"
        onPointerDown={(e) => pickIndex(e.clientX, e.currentTarget)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) pickIndex(e.clientX, e.currentTarget);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setSel(null);
        }}
        role="img"
        aria-label={`Diagramm: ${series.map((s) => s.name).join(", ")}`}
      >
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
              y={y(t) + 4}
              textAnchor="end"
              fontSize={FONT}
              fill="var(--muted)"
            >
              {Math.round(t)}
              {ySuffix}
            </text>
          </g>
        ))}

        {/* X-Labels */}
        {labels.map(
          (lab, i) =>
            showLabel(i) && (
              <text
                key={i}
                x={x(i)}
                y={H - 6}
                textAnchor={i === n - 1 && n > 1 ? "end" : "middle"}
                fontSize={FONT}
                fill="var(--muted)"
              >
                {lab}
              </text>
            ),
        )}

        {/* Auswahl-Linie */}
        {sel != null && (
          <line
            x1={x(sel)}
            x2={x(sel)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}

        {/* Linien */}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => (v == null ? null : { x: x(i), y: y(v), i }))
            .filter((p): p is { x: number; y: number; i: number } => p != null);
          if (!pts.length) return null;
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} />
              {pts.map((p) => (
                <circle
                  key={p.i}
                  cx={p.x}
                  cy={p.y}
                  r={p.i === sel ? 5 : 3}
                  fill={s.color}
                />
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
      <p className="mt-1 text-[11px] text-muted">Antippen für Werte eines Trainings</p>
    </div>
  );
}
