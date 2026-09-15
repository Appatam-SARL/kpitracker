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
import {
  Briefcase,
  Building2,
  MapPin,
  Radio,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type LeadDemographicsSectionProps = {
  companyId?: string;
  userId?: string;
  scopeLabel?: string;
};

function isPlaceholderLabel(label: string): boolean {
  return (
    label === LABEL_NONE ||
    label === 'Non déterminé' ||
    label === 'Non renseigné'
  );
}

function hasMeaningfulBarRows(rows: DonutDatum[]): boolean {
  const withData = rows.filter((r) => r.count > 0);
  if (withData.length === 0) return false;
  if (withData.length === 1 && isPlaceholderLabel(withData[0].label)) {
    return false;
  }
  return withData.some((r) => !isPlaceholderLabel(r.label));
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
    <div className='flex flex-col gap-5'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[220px] animate-pulse'
          />
        ))}
      </div>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-h-[280px] animate-pulse'
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

function SubsectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className='mb-3'>
      <h3 className='text-[13px] font-semibold text-gray-800'>{title}</h3>
      <p className='text-[11px] text-gray-500 mt-0.5'>{description}</p>
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
  const leadTypeRows = (data?.byLeadType ?? []) as DonutDatum[];
  const sourceRows = (data?.bySource ?? []) as DonutDatum[];
  const decisionRoleRows = (data?.byDecisionRole ?? []) as DonutDatum[];
  const showLocationChart = hasMeaningfulBarRows(locationRows);
  const showJobTitleChart = hasMeaningfulBarRows(jobTitleRows);
  const showLeadTypeChart = hasMeaningfulBarRows(leadTypeRows);
  const showSourceChart = hasMeaningfulBarRows(sourceRows);

  return (
    <section id='stats-repartition' className='scroll-mt-4'>
      <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-sm font-semibold text-gray-800'>
            Répartition des prospects
          </h2>
          <p className='text-xs text-gray-500 mt-0.5 max-w-xl'>
            Type de client, source, rôle du décideur, civilité, secteur,
            géographie et poste
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
        <div className='flex flex-col gap-6'>
          <div>
            <SubsectionTitle
              title='Qualification commerciale'
              description='Critères demandés pour le pilotage : type de client, source du lead et rôle du décideur.'
            />
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
              {showLeadTypeChart ? (
                <DemographicBarCard
                  title='Par type de client'
                  rows={leadTypeRows}
                  icon={Building2}
                  emptyMessage='Aucun type de client renseigné pour ce périmètre.'
                />
              ) : (
                <EmptyBarPlaceholder message='Aucun type de client exploitable. Renseignez le champ « Type de client » sur vos fiches entreprises.' />
              )}

              {showSourceChart ? (
                <DemographicBarCard
                  title='Par source du lead'
                  rows={sourceRows}
                  icon={Radio}
                  emptyMessage='Aucune source renseignée pour ce périmètre.'
                />
              ) : (
                <EmptyBarPlaceholder message='Aucune source de lead exploitable. Complétez le champ « Source » sur vos fiches entreprises.' />
              )}

              {hasMeaningfulBarRows(decisionRoleRows) ? (
                <MarketShareCard
                  title='Par rôle du décideur'
                  rows={decisionRoleRows}
                  centerMetric='sum'
                  maxLegendItems={6}
                />
              ) : (
                <EmptyBarPlaceholder message='Aucun rôle du décideur exploitable. Renseignez le rôle sur vos fiches contacts.' />
              )}
            </div>
            <p className='mt-2 text-[10px] text-gray-400'>
              Type de client et source sont comptés au niveau entreprise ;
              rôle du décideur au niveau contact
              {userId ? ' (créés par le commercial sélectionné)' : ''}.
            </p>
          </div>

          <div>
            <SubsectionTitle
              title='Profil démographique'
              description='Civilité, secteur d’activités, situation géographique et poste.'
            />
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
                  maxLegendItems={6}
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
                  <EmptyBarPlaceholder message='Aucun quartier, commune, ville ou pays renseigné sur les prospects de ce périmètre.' />
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
          </div>
        </div>
      )}
    </section>
  );
}
