'use client';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Tailwind bg-* class for the fill; defaults to a neutral indigo scale (single-hue magnitude). */
  barClassName?: string;
}

interface BarListProps {
  items: BarListItem[];
  emptyLabel?: string;
}

/**
 * Lista de barras horizontales para magnitudes (conteos por categoría/usuario).
 * Una sola escala de color por defecto; el llamador puede pasar color semántico
 * por ítem (ej. estado) via barClassName.
 */
export function BarList({ items, emptyLabel = 'Sin datos en el período seleccionado' }: BarListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, 3);
        return (
          <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 truncate">{item.label}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${item.barClassName ?? 'bg-indigo-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-900 text-right tabular-nums">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
