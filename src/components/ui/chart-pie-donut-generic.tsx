'use client';

import { Pie, PieChart } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export const DONUT_SEGMENT_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(199, 89%, 48%)',
  'hsl(215, 16%, 75%)',
  'hsl(262, 52%, 55%)',
  'hsl(142, 71%, 45%)',
  'hsl(32, 95%, 55%)',
  'hsl(221, 83%, 70%)',
  'hsl(199, 89%, 70%)',
];

export type DonutDatum = { label: string; count: number };

function buildChartConfig(labels: string[]): ChartConfig {
  const config: ChartConfig = { count: { label: 'Prospects' } };
  labels.forEach((label, i) => {
    config[label] = {
      label,
      color: DONUT_SEGMENT_COLORS[i % DONUT_SEGMENT_COLORS.length],
    };
  });
  return config;
}

function toChartRows(rows: DonutDatum[]) {
  return rows
    .filter((r) => r.count > 0)
    .map((row, index) => ({
      label: row.label,
      count: row.count,
      fill: DONUT_SEGMENT_COLORS[index % DONUT_SEGMENT_COLORS.length],
    }));
}

type MarketShareCardProps = {
  title: string;
  rows: DonutDatum[];
  maxLegendItems?: number;
  /** Valeur au centre du donut : somme des effectifs (défaut) ou nombre de catégories. */
  centerMetric?: 'sum' | 'categoryCount';
};

/** Carte type « Market Share » : légende à gauche, donut + total au centre à droite. */
export function MarketShareCard({
  title,
  rows,
  maxLegendItems,
  centerMetric = 'sum',
}: MarketShareCardProps) {
  const chartData = toChartRows(rows);
  const total = chartData.reduce((acc, d) => acc + d.count, 0);
  const centerValue =
    centerMetric === 'categoryCount' ? chartData.length : total;
  const chartConfig = buildChartConfig(chartData.map((d) => d.label));
  const legendRows =
    maxLegendItems !== undefined
      ? chartData.slice(0, maxLegendItems)
      : chartData;
  const hiddenLegendCount =
    maxLegendItems !== undefined
      ? Math.max(0, chartData.length - maxLegendItems)
      : 0;

  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col min-h-[220px]'>
      <h3 className='text-sm font-medium text-gray-600'>{title}</h3>

      {chartData.length === 0 ? (
        <p className='text-xs text-gray-400 mt-6 flex-1 flex items-center justify-center'>
          Aucune donnée
        </p>
      ) : (
        <div className='flex items-center gap-4 mt-4 flex-1 min-h-0'>
          <ul className='flex-1 min-w-0 space-y-2.5 max-h-[120px] overflow-y-auto pr-1'>
            {legendRows.map((d) => (
                <li
                  key={d.label}
                  className='flex items-center gap-2 text-xs'
                >
                  <span
                    className='w-2 h-2 rounded-full shrink-0'
                    style={{ backgroundColor: d.fill }}
                  />
                  <span
                    className='text-gray-700 truncate flex-1'
                    title={d.label}
                  >
                    {d.label}
                  </span>
                  <span className='text-gray-900 font-semibold tabular-nums shrink-0'>
                    {d.count.toLocaleString('fr-FR')}
                  </span>
                </li>
              ))}
            {hiddenLegendCount > 0 && (
              <li className='text-[10px] text-gray-400 pl-4'>
                +{hiddenLegendCount} autre
                {hiddenLegendCount > 1 ? 's' : ''}
              </li>
            )}
          </ul>

          <div className='relative shrink-0 w-[130px] h-[130px]'>
            <ChartContainer
              config={chartConfig}
              className='w-full h-full [&_.recharts-responsive-container]:!h-full'
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey='count'
                  nameKey='label'
                  innerRadius={42}
                  outerRadius={58}
                  strokeWidth={0}
                />
              </PieChart>
            </ChartContainer>
            <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
              <span className='text-xl font-bold text-gray-900 leading-none tabular-nums'>
                {centerValue.toLocaleString('fr-FR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TotalProspectsKpiCardProps = {
  total: number;
  scopeLabel?: string;
};

/** Carte KPI type dashboard (valeur principale à gauche). */
export function TotalProspectsKpiCard({
  total,
  scopeLabel,
}: TotalProspectsKpiCardProps) {
  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col justify-between min-h-[220px]'>
      <div>
        <h3 className='text-sm font-medium text-gray-600'>Total prospects</h3>
        <p className='text-3xl font-bold text-gray-900 mt-2 tabular-nums'>
          {total.toLocaleString('fr-FR')}
        </p>
        {scopeLabel && (
          <p className='text-xs text-gray-400 mt-1 truncate' title={scopeLabel}>
            {scopeLabel}
          </p>
        )}
      </div>
      <div className='flex items-end justify-end gap-1 h-16 mt-4 opacity-80'>
        {[40, 65, 45, 80, 55, 70, 50, 90].map((h, i) => (
          <span
            key={i}
            className='w-2 rounded-sm bg-primary/20'
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
