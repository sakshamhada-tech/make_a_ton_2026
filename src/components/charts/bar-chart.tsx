'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';

export interface BarDatum {
  label: string;
  valueMinor: number;
  hint?: string;
}

/**
 * Restrained horizontal-free bar chart drawn as inline SVG.
 * Fixed height, no animation beyond a subtle CSS transition.
 */
export function BarChart({ data, height = 140 }: { data: BarDatum[]; height?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-zinc-500">No data for this range.</p>;
  }
  const max = Math.max(...data.map((d) => d.valueMinor), 1);
  const width = 560;
  const barArea = height - 24;
  const gap = 6;
  const barWidth = Math.max((width - gap * (data.length - 1)) / data.length, 4);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Bar chart of collected revenue by month"
        style={{ height: 'auto' }}
      >
        {data.map((d, i) => {
          const h = Math.max((d.valueMinor / max) * barArea, 1);
          const x = i * (barWidth + gap);
          const y = barArea - h;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={2}
                fill={hovered === i ? '#115e59' : '#0f766e'}
                opacity={hovered === null || hovered === i ? 1 : 0.55}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fontSize="9" fill="#71717a">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-2xs text-zinc-500">
        {hovered !== null && data[hovered]
          ? `${data[hovered].label}: ${formatMoney(data[hovered].valueMinor)}`
          : `Peak: ${formatMoney(max)}`}
      </p>
    </div>
  );
}
