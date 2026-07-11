'use client';

import type { LeadDemographicsResponse } from '@/lib/lead-demographics-report';
import { useAuth } from '@/contexts/AuthContext';
import { fetchApi } from '@/lib/fetch-api';
import { LABEL_NONE } from '@/lib/lead-demographics';
import { DemographicBarCard } from '@/components/ui/chart-location-bars';
import {
  MarketShareCard,
  TotalProspectsKpiCard,
  type DonutDatum,
} from '@/components/ui/chart-pie-donut-generic';
import { Briefcase, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type LeadDemographicsSectionProps = {
  companyId?: string;
  userId?: string;
  scopeLabel?: string;
};

function hasMeaningfulBarRows(rows: DonutDatum[]): boolean {
  const withData = rows.filter((r) => r.count > 0);
  if (withData.length === 0) return false;
  if (withData.length === 1 && withData[0].label === LABEL_NONE) return false;
  return true;
}

function EmptyBarPlaceholder({ message }: { message: string }) {
  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[280px] flex items-center justify-center'>
      <p className='text-xs text-gray-500 text-center px-4'>{message}</p>
    </div>
  );
}

function DemographicsSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[220px] animate-pulse'
          />
        ))}
      </div>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[280px] animate-pulse' />
        <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[280px] animate-pulse' />
      </div>
    </div>
  );
}

export function LeadDemographicsSection({
  companyId,
  userId,
  scopeLabel,
}: LeadDemographicsSectionProps) {
  const { user: authUser } = useAuth();

  const [data, setData] = useState<LeadDemographicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDemographics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (companyId?.trim()) {
        params.set('companyId', companyId.trim());
      }
      if (userId?.trim()) {
        params.set('userId', userId.trim());
      }
      const qs = params.toString();
      const url = qs
        ? `/api/dashboard/lead-demographics?${qs}`
        : '/api/dashboard/lead-demographics';
      const res = await fetchApi(url, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setData(null);
        setError(
          typeof json?.error === 'string'
            ? json.error
            : 'Impossible de charger la répartition des prospects.',
        );
        return;
      }
      setData(json as LeadDemographicsResponse);
    } catch {
      setData(null);
      setError('Impossible de charger la répartition des prospects.');
    } finally {
      setLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => {
    void fetchDemographics();
  }, [fetchDemographics]);

  useEffect(() => {
    const onInvalidate = () => {
      void fetchDemographics();
    };
    window.addEventListener('crm:goals-invalidate', onInvalidate);
    return () => {
      window.removeEventListener('crm:goals-invalidate', onInvalidate);
    };
  }, [fetchDemographics]);

  const kpiScope =
    scopeLabel ?? authUser?.company?.name ?? 'Périmètre actuel';
  const locationRows = (data?.byLocation ?? []) as DonutDatum[];
  const jobTitleRows = (data?.byJobTitle ?? []) as DonutDatum[];
  const showLocationChart = hasMeaningfulBarRows(locationRows);
  const showJobTitleChart = hasMeaningfulBarRows(jobTitleRows);

  return (
    <section className='mt-4'>
      <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-sm font-semibold text-gray-800'>
            Répartition des prospects
          </h2>
          <p className='text-xs text-gray-500 mt-0.5'>
            Civilité, secteur d&apos;activités, situation géographique et poste
          </p>
        </div>
        {(scopeLabel || (!loading && data && data.total > 0)) && (
          <span
            className='inline-flex items-center self-start rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-600 shadow-sm'
            title={kpiScope}
          >
            {kpiScope}
          </span>
        )}
      </div>

      {loading && <DemographicsSkeleton />}

      {!loading && error && (
        <p className='text-xs text-red-600 bg-white rounded-2xl border border-red-100 p-4'>
          {error}
        </p>
      )}

      {!loading && !error && data && data.total === 0 && (
        <p className='text-xs text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm p-5'>
          Aucun prospect sur ce périmètre pour le moment.
        </p>
      )}

      {!loading && !error && data && data.total > 0 && (
        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <TotalProspectsKpiCard total={data.total} scopeLabel={kpiScope} />

            <MarketShareCard
              title='Par civilité'
              rows={data.byCivility as DonutDatum[]}
              centerMetric='categoryCount'
            />

            <MarketShareCard
              title="Par secteur d'activités"
              rows={data.byActivitySector as DonutDatum[]}
              centerMetric='categoryCount'
            />
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            {showLocationChart ? (
              <DemographicBarCard
                title='Par situation géographique'
                rows={locationRows}
                icon={MapPin}
                emptyMessage='Aucune situation géographique renseignée pour ce périmètre.'
              />
            ) : (
              <EmptyBarPlaceholder message='Aucune situation géographique renseignée sur les prospects de ce périmètre. Complétez le champ « Situation géographique » sur vos fiches leads.' />
            )}

            {showJobTitleChart ? (
              <DemographicBarCard
                title='Par poste du prospect'
                rows={jobTitleRows}
                icon={Briefcase}
                emptyMessage='Aucun poste renseigné pour ce périmètre.'
              />
            ) : (
              <EmptyBarPlaceholder message='Aucun poste renseigné sur les prospects de ce périmètre. Complétez le champ « Poste / fonction » sur vos fiches leads.' />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
