'use client';

import { TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pie, PieChart } from 'recharts';

import {
  NEGOTIATION_STAGE_LABELS,
  NEGOTIATION_STAGE_ORDER,
} from '@/config/negotiation-stage';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export const description = 'Répartition des stades de négociation';

const STATUS_LABELS: Record<string, string> = {
  ...NEGOTIATION_STAGE_LABELS,
};

const defaultChartData = NEGOTIATION_STAGE_ORDER.map((status, index) => ({
  status,
  count: 0,
  fill: `var(--chart-${index + 1})`,
}));

const chartConfig = {
  leads: {
    label: 'Prospects',
  },
  EN_PROSPECTION: {
    label: NEGOTIATION_STAGE_LABELS.EN_PROSPECTION,
    color: 'var(--chart-1)',
  },
  VENTE_CONCLUE: {
    label: NEGOTIATION_STAGE_LABELS.VENTE_CONCLUE,
    color: 'var(--chart-2)',
  },
  VENTE_PERDUE: {
    label: NEGOTIATION_STAGE_LABELS.VENTE_PERDUE,
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

function dashboardApiUrl(path: string, companyId?: string): string {
  if (!companyId?.trim()) return path;
  const params = new URLSearchParams({ companyId: companyId.trim() });
  return `${path}?${params.toString()}`;
}

type ChartPieDonutProps = {
  companyId?: string;
  /** Masque le titre interne (quand le parent fournit déjà un en-tête). */
  embedded?: boolean;
};

function ChartLegend({
  items,
}: {
  items: Array<{ key: string; label: string; count: number; fill: string }>;
}) {
  return (
    <div className='flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5'>
      {items.map((d) => (
        <div key={d.key} className='flex items-center gap-1.5'>
          <span
            className='h-2.5 w-2.5 rounded-full shrink-0'
            style={{ backgroundColor: d.fill }}
          />
          <span className='text-[11px] text-gray-600'>
            {d.label}
            <span className='ml-0.5 tabular-nums text-gray-400'>({d.count})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartPieDonut({
  companyId,
  embedded = false,
}: ChartPieDonutProps = {}) {
  const [data, setData] = useState(defaultChartData);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatusDistribution = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          dashboardApiUrl(
            '/api/dashboard/lead-status-distribution',
            companyId,
          ),
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          status: string;
          count: number;
        }>;
        const chartData = rows.map((row, index) => ({
          status: row.status as (typeof NEGOTIATION_STAGE_ORDER)[number],
          count: Number(row.count ?? 0),
          fill: `var(--chart-${index + 1})`,
        }));

        const sum = chartData.reduce((acc, d) => acc + d.count, 0);
        setData(chartData);
        setTotal(sum);
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    };

    void fetchStatusDistribution();

    const onInvalidate = () => {
      void fetchStatusDistribution();
    };
    window.addEventListener('crm:goals-invalidate', onInvalidate);
    return () => {
      window.removeEventListener('crm:goals-invalidate', onInvalidate);
    };
  }, [companyId]);

  const legendItems = data.map((d) => ({
    key: d.status,
    label: STATUS_LABELS[d.status] ?? d.status,
    count: d.count,
    fill: d.fill,
  }));

  return (
    <div className='flex flex-col gap-3'>
      {!embedded && (
        <div className='text-center'>
          <p className='text-sm font-semibold text-gray-800'>
            Répartition des stades
          </p>
          <p className='text-[11px] text-gray-500'>
            Vue globale par stade de négociation
          </p>
        </div>
      )}

      {loading ? (
        <div className='mx-auto h-48 w-full max-w-xs animate-pulse rounded-2xl bg-gray-100' />
      ) : total === 0 ? (
        <p className='py-10 text-center text-xs text-gray-500'>
          Aucun prospect à afficher sur ce périmètre.
        </p>
      ) : (
        <>
          <ChartLegend items={legendItems} />
          <ChartContainer
            config={chartConfig}
            className='mx-auto aspect-square h-48 w-full max-w-55'
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={data.filter((d) => d.count > 0)}
                dataKey='count'
                nameKey='status'
                innerRadius={52}
                outerRadius={72}
                strokeWidth={2}
                stroke='white'
              />
            </PieChart>
          </ChartContainer>
          <p className='flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-600'>
            {total} contact{total !== 1 ? 's' : ''} par stade
            <TrendingUp className='h-3.5 w-3.5 text-primary' />
          </p>
        </>
      )}
    </div>
  );
}

// ——— Donut par source d'acquisition ———
const SOURCE_LABEL_NONE = 'Non renseigné';
const SOURCE_LABEL_OTHER = 'Autres';

/** Sources d'acquisition standard affichées dans le graphique */
const ACQUISITION_SOURCES = [
  SOURCE_LABEL_NONE,
  'Client inbound',
  'Prospection mail - téléphone',
  'Recommandation client',
  'Prospection terrain',
  'Événement',
  'Facebook',
  'Tik Tok',
  'LinkedIn',
  'Appel d\'offres',
  SOURCE_LABEL_OTHER,
] as const;

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
];

/** Ramène la valeur libre du lead à une source d'acquisition standard. */
function normalizeAcquisitionSource(raw: unknown): string {
  if (raw == null || typeof raw !== 'string') return SOURCE_LABEL_NONE;
  const s = raw.trim().toLowerCase();
  if (!s) return SOURCE_LABEL_NONE;

  const exact = ACQUISITION_SOURCES.find(
    (l) =>
      l !== SOURCE_LABEL_NONE &&
      l.toLowerCase() === s,
  );
  if (exact) return exact;

  if (s.includes('inbound') || s.includes('appel entrant')) {
    return 'Client inbound';
  }
  if (s.includes('mail') || s.includes('téléphone') || s.includes('telephone') || s.includes('email')) {
    return 'Prospection mail - téléphone';
  }
  if (s.includes('recommandation') || s.includes('bouche')) {
    return 'Recommandation client';
  }
  if (s.includes('terrain')) return 'Prospection terrain';
  if (s.includes('événement') || s.includes('evenement') || s.includes('salon')) {
    return 'Événement';
  }
  if (s.includes('facebook')) return 'Facebook';
  if (s.includes('tik tok') || s.includes('tiktok')) return 'Tik Tok';
  if (s.includes('linkedin')) return 'LinkedIn';
  if (s.includes("appel d'offre") || s.includes('appel d’offre')) {
    return 'Appel d\'offres';
  }
  if (s === 'autre' || s === 'autres') return SOURCE_LABEL_OTHER;

  return SOURCE_LABEL_OTHER;
}

function buildSourceChartConfig(sources: readonly string[]): ChartConfig {
  const config: ChartConfig = { count: { label: 'Prospects' } };
  sources.forEach((source, i) => {
    config[source] = {
      label: source,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });
  return config;
}

const defaultSourceChartConfig = buildSourceChartConfig(ACQUISITION_SOURCES);
const defaultSourceData = ACQUISITION_SOURCES.map((source, i) => ({
  source,
  count: 0,
  fill: CHART_COLORS[i % CHART_COLORS.length],
}));

export function ChartPieDonutBySource({
  companyId,
  embedded = false,
}: ChartPieDonutProps = {}) {
  const [data, setData] = useState(defaultSourceData);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartConfig] = useState<ChartConfig>(defaultSourceChartConfig);

  useEffect(() => {
    const fetchSourceDistribution = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          dashboardApiUrl(
            '/api/dashboard/lead-source-distribution',
            companyId,
          ),
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const leads = (await res.json()) as Array<{ source: string | null }>;

        const counts: Record<string, number> = {};
        ACQUISITION_SOURCES.forEach((src) => {
          counts[src] = 0;
        });

        for (const lead of leads) {
          const source = normalizeAcquisitionSource(lead.source);
          counts[source] = (counts[source] ?? 0) + 1;
        }

        const chartData = ACQUISITION_SOURCES.map((source, index) => ({
          source,
          count: counts[source] ?? 0,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        })).filter((d) => d.count > 0);

        const sum = chartData.reduce((acc, d) => acc + d.count, 0);
        setData(chartData.length > 0 ? chartData : []);
        setTotal(sum);
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    };

    void fetchSourceDistribution();

    const onInvalidate = () => {
      void fetchSourceDistribution();
    };
    window.addEventListener('crm:goals-invalidate', onInvalidate);
    return () => {
      window.removeEventListener('crm:goals-invalidate', onInvalidate);
    };
  }, [companyId]);

  const legendItems = data.map((d) => ({
    key: d.source,
    label: d.source,
    count: d.count,
    fill: d.fill,
  }));

  return (
    <div className='flex flex-col gap-3'>
      {!embedded && (
        <div className='text-center'>
          <p className='text-sm font-semibold text-gray-800'>
            Répartition par source
          </p>
          <p className='text-[11px] text-gray-500'>
            Prospects selon leur source d&apos;acquisition
          </p>
        </div>
      )}

      {loading ? (
        <div className='mx-auto h-48 w-full max-w-xs animate-pulse rounded-2xl bg-gray-100' />
      ) : total === 0 ? (
        <p className='py-10 text-center text-xs text-gray-500'>
          Aucun prospect à afficher sur ce périmètre.
        </p>
      ) : (
        <>
          <ChartLegend items={legendItems} />
          <ChartContainer
            config={chartConfig}
            className='mx-auto aspect-square h-48 w-full max-w-55'
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={data}
                dataKey='count'
                nameKey='source'
                innerRadius={52}
                outerRadius={72}
                strokeWidth={2}
                stroke='white'
              />
            </PieChart>
          </ChartContainer>
          <p className='flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-600'>
            {total} prospect{total !== 1 ? 's' : ''} par source
            <TrendingUp className='h-3.5 w-3.5 text-primary' />
          </p>
        </>
      )}
    </div>
  );
}
