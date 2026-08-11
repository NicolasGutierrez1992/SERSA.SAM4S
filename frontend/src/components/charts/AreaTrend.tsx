'use client';

import { useId, useState } from 'react';

export interface AreaTrendPoint {
  label: string;
  value: number;
  /** Full date for the tooltip, e.g. "11/08/2026" */
  fullLabel?: string;
}

interface AreaTrendProps {
  data: AreaTrendPoint[];
  height?: number;
  emptyLabel?: string;
}

const VIEW_W = 600;

/**
 * Gráfico de área/línea liviano en SVG puro (sin librería externa) para una
 * serie temporal simple. Escala su propio viewBox, así que es responsive por
 * naturaleza dentro de cualquier contenedor.
 */
export function AreaTrend({ data, height = 180, emptyLabel = 'Sin actividad en el período seleccionado' }: AreaTrendProps) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">{emptyLabel}</p>;
  }

  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const innerW = VIEW_W - padX * 2;
  const innerH = height - padTop - padBottom;

  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + innerH - (d.value / max) * innerH;
    return { x, y, d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${padTop + innerH} L ${points[0].x.toFixed(2)} ${padTop + innerH} Z`;

  // Muestra como mucho ~6 etiquetas en el eje para no amontonar texto en pantallas chicas.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grilla horizontal tenue */}
        {[0, 0.5, 1].map((f) => {
          const y = padTop + innerH * f;
          return (
            <line key={f} x1={padX} y1={y} x2={VIEW_W - padX} y2={y} stroke="#eef0f4" strokeWidth={1} />
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Eje de fechas */}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={p.x} y={height - 6} fontSize={10} textAnchor="middle" fill="#9ca3af">
              {p.d.label}
            </text>
          ) : null,
        )}

        {/* Hit targets + punto destacado */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 4.5 : 3}
              fill="#4f46e5"
              stroke="#fff"
              strokeWidth={1.5}
              className="transition-all"
            />
            <rect
              x={p.x - stepX / 2}
              y={padTop}
              width={Math.max(stepX, 12)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{
            left: `${(hovered.x / VIEW_W) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
            marginTop: -10,
          }}
        >
          <div className="font-semibold">{hovered.d.fullLabel ?? hovered.d.label}</div>
          <div className="text-gray-300">{hovered.d.value} eventos</div>
        </div>
      )}
    </div>
  );
}
