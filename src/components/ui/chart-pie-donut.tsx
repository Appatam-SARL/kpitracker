'use client';

import { TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pie, PieChart } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export const description = 'Répartition des statuts de leads';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  QUALIFIED: 'Qualifié',
  LOST: 'Perdu',
  CONVERTED: 'Converti',
};

const defaultChartData = [
  { status: 'NEW', count: 1, fill: 'var(--chart-1)' },
  { status: 'CONTACTED', count: 1, fill: 'var(--chart-2)' },
  { status: 'QUALIFIED', count: 1, fill: 'var(--chart-3)' },
  { status: 'LOST', count: 1, fill: 'var(--chart-4)' },
  { status: 'CONVERTED', count: 1, fill: 'var(--chart-5)' },
];

const chartConfig = {
  leads: {
    label: 'Leads',
  },
  NEW: {
    label: 'Nouveau',
    color: 'var(--chart-1)',
  },
  CONTACTED: {
    label: 'Contacté',
    color: 'var(--chart-2)',
  },
  QUALIFIED: {
    label: 'Qualifié',
    color: 'var(--chart-3)',
  },
  LOST: {
    label: 'Perdu',
    color: 'var(--chart-4)',
  },
  CONVERTED: {
    label: 'Converti',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

function dashboardApiUrl(path: string, companyId?: string): string {
  if (!companyId?.trim()) return path;
  const params = new URLSearchParams({ companyId: companyId.trim() });
  return `${path}?${params.toString()}`;
}

type ChartPieDonutProps = {
  companyId?: string;
};

export function ChartPieDonut({ companyId }: ChartPieDonutProps = {}) {
  const [data, setData] = useState(defaultChartData);
  const [total, setTotal] = useState(
    defaultChartData.reduce((acc, d) => acc + d.count, 0),
  );

  useEffect(() => {
    const fetchStatusDistribution = async () => {
      try {
        const res = await fetch(
          dashboardApiUrl(
            '/api/dashboard/lead-status-distribution',
            companyId,
          ),
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{ status: string; count: number }>;
        const chartData = rows.map((row, index) => ({
          status: row.status,
          count: Number(row.count ?? 0),
          fill: `var(--chart-${index + 1})`,
        }));

        const sum = chartData.reduce((acc, d) => acc + d.count, 0);
        if (sum > 0) {
          setData(chartData);
          setTotal(sum);
        } else {
          setData(defaultChartData.map((d) => ({ ...d, count: 0 })));
          setTotal(0);
        }
      } catch {
        // en cas d'erreur on garde les données par défaut
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

  return (
    <Card className='flex flex-col'>
      <CardHeader className='items-center pb-0'>
        <CardTitle>Répartition des statuts</CardTitle>
        <CardDescription>Vue globale des leads par statut</CardDescription>
      </CardHeader>
      <CardContent className='flex-1 pb-0 flex flex-col gap-4 px-6 pt-2'>
        {/* Légende au-dessus du graphique (avec effectif par compartiment) */}
        <div className='flex flex-wrap items-center justify-center gap-3 gap-y-1.5'>
          {data.map((d) => (
            <div key={d.status} className='flex items-center gap-1.5'>
              <span
                className='w-3 h-3 rounded-sm shrink-0'
                style={{ backgroundColor: d.fill }}
              />
              <span className='text-[11px] text-gray-700'>
                {STATUS_LABELS[d.status] ?? d.status}
                {d.count >= 0 && ` (${d.count})`}
              </span>
            </div>
          ))}
        </div>
        <ChartContainer
          config={chartConfig}
          className='mx-auto w-full min-h-[250px] h-[250px]'
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey='count'
              nameKey='status'
              innerRadius={60}
              outerRadius={80}
              // paddingAngle={5}
              // stroke='white'
              // strokeWidth={1.5}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        <div className='flex items-center gap-2 leading-none font-medium'>
          {total} leads répartis par statut
          <TrendingUp className='h-4 w-4' />
        </div>
        <div className='text-muted-foreground leading-none'>
          Statuts :{' '}
          {data
            .filter((d) => d.count > 0)
            .map((d) => STATUS_LABELS[d.status] ?? d.status)
            .join(', ') || 'aucun lead pour le moment'}
        </div>
      </CardFooter>
    </Card>
  );
}

// ——— Donut par source d'acquisition (Facebook, WhatsApp, etc.) ———
const SOURCE_LABEL_NONE = 'Non renseigné';
const SOURCE_LABEL_OTHER = 'Autre';

/** Sources d'acquisition standard affichées dans le graphique */
const ACQUISITION_SOURCES = [
  SOURCE_LABEL_NONE,
  'Facebook',
  'WhatsApp',
  'Site web',
  'Bouche-à-oreille',
  'Email',
  'Partenaires',
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
  if (s.includes('facebook')) return 'Facebook';
  if (s.includes('whatsapp') || s.includes('whats app')) return 'WhatsApp';
  if (
    s.includes('site web') ||
    s === 'web' ||
    s.includes('internet') ||
    s.includes('site')
  )
    return 'Site web';
  if (
    s.includes('bouche') ||
    s.includes('recommandation') ||
    s.includes('oreille')
  )
    return 'Bouche-à-oreille';
  if (s.includes('email') || s.includes('mail')) return 'Email';
  if (
    s.includes('partenaire') ||
    s.includes('cabinet') ||
    s.includes('recrutement') ||
    s.includes('cooperative') ||
    s.includes('banque')
  )
    return 'Partenaires';
  // Correspondance exacte (sans accent / casse) pour les libellés standard
  const exact = ACQUISITION_SOURCES.find(
    (l) =>
      l !== SOURCE_LABEL_NONE &&
      l !== SOURCE_LABEL_OTHER &&
      l.toLowerCase() === s,
  );
  if (exact) return exact;
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

export function ChartPieDonutBySource({ companyId }: ChartPieDonutProps = {}) {
  const [data, setData] = useState(defaultSourceData);
  const [total, setTotal] = useState(0);
  const [chartConfig] = useState<ChartConfig>(defaultSourceChartConfig);

  useEffect(() => {
    const fetchSourceDistribution = async () => {
      try {
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
        setData(
          chartData.length > 0
            ? chartData
            : defaultSourceData.filter((d) => d.source === SOURCE_LABEL_NONE),
        );
        setTotal(sum);
      } catch {
        // en cas d'erreur on garde les données par défaut
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

  return (
    <Card className='flex flex-col'>
      <CardHeader className='items-center pb-0'>
        <CardTitle>Répartition par source</CardTitle>
        <CardDescription>
          Prospects selon leur source d&apos;acquisition
        </CardDescription>
      </CardHeader>
      <CardContent className='flex-1 pb-0 flex flex-col gap-4 px-6 pt-2'>
        {/* Légende au-dessus du graphique (avec effectif par compartiment) */}
        <div className='flex flex-wrap items-center justify-center gap-3 gap-y-1.5'>
          {data.map((d) => (
            <div key={d.source} className='flex items-center gap-1.5'>
              <span
                className='w-3 h-3 rounded-sm shrink-0'
                style={{ backgroundColor: d.fill }}
              />
              <span className='text-[11px] text-gray-700'>
                {d.source} ({d.count})
              </span>
            </div>
          ))}
        </div>
        <ChartContainer
          config={chartConfig}
          className='mx-auto w-full min-h-[250px] h-[250px]'
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
              innerRadius={60}
              outerRadius={80}
              // paddingAngle={5}
              // stroke='white'
              // strokeWidth={1.5}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        <div className='flex items-center gap-2 leading-none font-medium'>
          {total} prospect{total !== 1 ? 's' : ''} répartis par source
          <TrendingUp className='h-4 w-4' />
        </div>
        <div className='text-muted-foreground leading-none text-center break-words max-h-12 overflow-y-auto'>
          {data.filter((d) => d.count > 0).length
            ? data
                .filter((d) => d.count > 0)
                .map((d) => `${d.source} (${d.count})`)
                .join(', ')
            : 'Aucun prospect pour le moment'}
        </div>
      </CardFooter>
    </Card>
  );
}
