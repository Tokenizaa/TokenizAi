import React, { useState } from 'react';
import type { WeeklyProgressPoint } from '../../types/enterprise';

interface WeeklyProgressChartProps {
  data: WeeklyProgressPoint[];
}

export const WeeklyProgressChart: React.FC<WeeklyProgressChartProps> = ({ data }) => {
  const [metric, setMetric] = useState<'deliveries' | 'financial' | 'capacity'>('deliveries');
  const [hoveredIdx, setHoveredIdx] = useState<number>(data.length - 1);

  const activePoint = data[hoveredIdx] ?? data[data.length - 1];
  const width = 560;
  const height = 180;
  const padX = 28;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const getValues = () => {
    if (metric === 'deliveries') {
      return {
        primary: data.map((d) => d.deliveriesCompleted),
        secondary: data.map((d) => d.deliveriesPlanned),
        max: Math.max(...data.map((d) => Math.max(d.deliveriesCompleted, d.deliveriesPlanned)), 20),
        primaryLabel: 'Entregas Concluídas',
        secondaryLabel: 'Planejado',
        unit: 'entregas',
      };
    }
    if (metric === 'financial') {
      return {
        primary: data.map((d) => d.revenueK),
        secondary: data.map((d) => d.expenseK),
        max: Math.max(...data.map((d) => Math.max(d.revenueK, d.expenseK)), 220),
        primaryLabel: 'Receita (R$ mil)',
        secondaryLabel: 'Despesa (R$ mil)',
        unit: 'k',
      };
    }
    return {
      primary: data.map((d) => d.capacityUsedPercent),
      secondary: data.map(() => 85),
      max: 100,
      primaryLabel: 'Capacidade Alocada (%)',
      secondaryLabel: 'Limite Saudável (85%)',
      unit: '%',
    };
  };

  const series = getValues();

  const toCoords = (vals: number[]) =>
    vals.map((v, i) => {
      const x = padX + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = padY + innerH - (v / series.max) * innerH;
      return { x, y, v };
    });

  const primaryCoords = toCoords(series.primary);
  const secondaryCoords = toCoords(series.secondary);

  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Relatório Semanal de Progresso</h3>
          <p className="text-xs text-ink-subtle">
            Série demonstrativa das últimas 6 semanas · passe o cursor para inspecionar
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-subtle border border-line">
          <button
            type="button"
            onClick={() => setMetric('deliveries')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              metric === 'deliveries' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Entregas
          </button>
          <button
            type="button"
            onClick={() => setMetric('financial')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              metric === 'financial' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Receita × Despesa
          </button>
          <button
            type="button"
            onClick={() => setMetric('capacity')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              metric === 'capacity' ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Capacidade
          </button>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible" role="img" aria-label="Gráfico semanal de desempenho">
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padY + innerH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                className="text-line opacity-60"
                strokeDasharray="3 3"
              />
            );
          })}

          <path
            d={toPath(secondaryCoords)}
            fill="none"
            stroke="currentColor"
            className="text-ink-subtle/50"
            strokeWidth="1.75"
            strokeDasharray="4 4"
          />

          <path
            d={toPath(primaryCoords)}
            fill="none"
            stroke="var(--nc-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {primaryCoords.map((pt, idx) => {
            const active = idx === hoveredIdx;
            return (
              <g key={data[idx].weekLabel}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 5.5 : 3.5}
                  fill={active ? 'var(--nc-accent)' : 'var(--nc-surface)'}
                  stroke="var(--nc-accent)"
                  strokeWidth="2"
                />
                <rect
                  x={pt.x - 28}
                  y={0}
                  width={56}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onClick={() => setHoveredIdx(idx)}
                />
                <text
                  x={pt.x}
                  y={height - 2}
                  textAnchor="middle"
                  className="text-[11px] fill-current text-ink-subtle font-mono"
                >
                  {data[idx].weekLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-line text-xs">
          <div className="flex items-center gap-4">
            <span className="font-mono font-medium text-ink">{activePoint.weekLabel}</span>
            <span className="text-ink-muted">
              {series.primaryLabel}:{' '}
              <strong className="font-mono tabular-nums text-ink">
                {series.primary[hoveredIdx]} {series.unit}
              </strong>
            </span>
            <span className="text-ink-subtle">
              {series.secondaryLabel}:{' '}
              <span className="font-mono tabular-nums">
                {series.secondary[hoveredIdx]} {series.unit}
              </span>
            </span>
          </div>
          <span className="text-ink-subtle tabular-nums">
            Capacidade: {activePoint.capacityUsedPercent}%
          </span>
        </div>
      )}
    </div>
  );
};
