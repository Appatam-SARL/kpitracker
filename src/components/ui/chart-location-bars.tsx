'use client';

import { MapPin, type LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { DONUT_SEGMENT_COLORS, type DonutDatum } from '@/components/ui/chart-pie-donut-generic';

const chartConfig = {
  count: { label: 'Prospects', color: DONUT_SEGMENT_COLORS[0] },
} satisfies ChartConfig;

const MAX_VISIBLE_BARS = 10;

function truncateLabel(label: string, max = 28): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

type DemographicBarCardProps = {
  title: string;
  rows: DonutDatum[];
  icon?: LucideIcon;
  emptyMessage?: string;
};

export function DemographicBarCard({
  title,
  rows,
  icon: Icon = MapPin,
  emptyMessage = 'Aucune donnée renseignée pour ce périmètre.',
}: DemographicBarCardProps) {
  const chartData = rows
    .filter((r) => r.count > 0)
    .slice(0, MAX_VISIBLE_BARS)
    .map((row, index) => ({
      label: row.label,
      shortLabel: truncateLabel(row.label),
      count: row.count,
      fill: DONUT_SEGMENT_COLORS[index % DONUT_SEGMENT_COLORS.length],
    }));

  const chartHeight = Math.min(420, Math.max(220, chartData.length * 40 + 24));

  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col min-h-[280px]'>
      <div className='flex items-center gap-2 mb-4'>
        <Icon className='h-4 w-4 text-primary shrink-0' aria-hidden />
        <h3 className='text-sm font-medium text-gray-600'>{title}</h3>
      </div>

      {chartData.length === 0 ? (
        <p className='text-xs text-gray-400 flex-1 flex items-center justify-center py-8'>
          {emptyMessage}
        </p>
      ) : (
        <div
          className='w-full overflow-y-auto overflow-x-hidden pr-1'
          style={{ maxHeight: chartData.length > 8 ? 360 : undefined }}
        >
          <ChartContainer
            config={chartConfig}
            className='w-full [&_.recharts-responsive-container]:!h-auto'
            style={{ height: chartHeight }}
          >
            <BarChart
              data={chartData}
              layout='vertical'
              margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
              barCategoryGap='20%'
            >
              <XAxis type='number' hide domain={[0, 'dataMax']} />
              <YAxis
                type='category'
                dataKey='shortLabel'
                width={130}
                tick={{ fontSize: 11, fill: '#4b5563' }}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip
                cursor={{ fill: 'hsl(221 83% 53% / 0.08)' }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className='flex flex-col gap-0.5'>
                        <span className='font-medium text-gray-900'>
                          {item.payload?.label}
                        </span>
                        <span className='text-muted-foreground'>
                          {Number(value).toLocaleString('fr-FR')} prospect
                          {Number(value) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey='count' radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey='count'
                  position='right'
                  className='fill-gray-800 text-[11px] font-semibold'
                  formatter={(v: number) => v.toLocaleString('fr-FR')}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

/** @deprecated Utiliser DemographicBarCard */
export function LocationBarCard({
  title = 'Par situation géographique',
  rows,
}: {
  title?: string;
  rows: DonutDatum[];
}) {
  return (
    <DemographicBarCard
      title={title}
      rows={rows}
      emptyMessage='Aucune localisation renseignée pour ce périmètre.'
    />
  );
}
