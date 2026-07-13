'use client';

import AgendaTab from '@/components/AgendaTab';
import CreateEmailModal from '@/components/CreateEmailModal';
import EmailsTabContent from '@/components/EmailsTabContent';
import InteractionHistory, {
  type Activity,
} from '@/components/InteractionHistory';
import LeadAttachmentsBlock from '@/components/lead-attachments/LeadAttachmentsBlock';
import type { Lead } from '@/components/LeadCard';
import LeadEditSheet from '@/components/LeadEditSheet';
import LeadInterestsEstimatorCard, {
  type InterestItemLite,
  type InterestsPayloadItem,
} from '@/components/LeadInterestsEstimatorCard';
import MeetingsTabContent from '@/components/MeetingsTabContent';
import DashboardShell from '@/components/layouts/DashboardShell';
import NeumoCard from '@/components/NeumoCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { ArrowLeft, Building2, Check, ChevronDown, Search } from 'lucide-react';
import { CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE } from '@/lib/lead-conversion';
import Link from 'next/link';
import { useEffect, useMemo, useState, use } from 'react';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau lead',
  CONTACTED: 'Contacté',
  QUALIFIED: 'Qualifié',
  LOST: 'Perdu',
  CONVERTED: 'Converti',
};

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 border border-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-800 border border-amber-200',
  QUALIFIED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  LOST: 'bg-rose-100 text-rose-700 border border-rose-200',
  CONVERTED: 'bg-teal-100 text-teal-700 border border-teal-200',
};

const LIFECYCLE_STAGES = [
  { key: 'NEW', label: 'Nouveau' },
  { key: 'CONTACTED', label: 'Contacté' },
  { key: 'QUALIFIED', label: 'Qualifié' },
  { key: 'LOST', label: 'Perdu' },
  { key: 'CONVERTED', label: 'Converti' },
] as const;

const ACTIVITY_TABS = [
  { key: 'activity', label: 'Activité', filterType: undefined },
  { key: 'agenda', label: 'Agenda', filterType: undefined },
  { key: 'notes', label: 'Notes', filterType: 'NOTE' },
  { key: 'emails', label: 'Emails', filterType: 'EMAIL' },
  { key: 'calls', label: 'Appels', filterType: 'CALL' },
  { key: 'meetings', label: 'Rendez-vous', filterType: 'MEETING' },
];

interface LeadDetail {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  activitySector?: string | null;
  activityDomains?: string[];
  notes?: string | null;
  civility?: string | null;
  status: string;
  companyId: string;
  company: { id: string; name: string };
  activities: Activity[];
  products?: { id: string; name: string }[];
  services?: { id: string; name: string }[];
  productInterests?: {
    product?: { id: string; name: string } | null;
    customName?: string | null;
    estimatedValue: number;
  }[];
  serviceInterests?: {
    service?: { id: string; name: string } | null;
    customName?: string | null;
    estimatedValue: number;
  }[];
  totalActivities?: number;
  hasMoreActivities?: boolean;
}

type CompanyCatalogLite = {
  id: string;
  name: string;
  products: InterestItemLite[];
  services: InterestItemLite[];
};

function formatMoneyFr(value: number) {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function normalizeCustomName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

function makeCustomKey(kind: 'product' | 'service', customName: string) {
  return `custom:${kind}:${normalizeCustomName(customName)}`;
}

/** Résumé affiché dans le bloc profil : pivots d'intérêt en priorité, sinon relations legacy. */
function leadProductInterestSummary(lead: LeadDetail): string {
  if (lead.productInterests && lead.productInterests.length > 0) {
    return lead.productInterests
      .map((i) => {
        const name = i.product?.name ?? i.customName ?? 'Autre produit';
        const label = `${name} (${formatMoneyFr(i.estimatedValue)} FCFA)`;
        return label;
      })
      .join(', ');
  }
  if (lead.products && lead.products.length > 0) {
    return lead.products.map((p) => p.name).join(', ');
  }
  return '—';
}

function leadServiceInterestSummary(lead: LeadDetail): string {
  if (lead.serviceInterests && lead.serviceInterests.length > 0) {
    return lead.serviceInterests
      .map((i) => {
        const name = i.service?.name ?? i.customName ?? 'Autre service';
        const label = `${name} (${formatMoneyFr(i.estimatedValue)} FCFA)`;
        return label;
      })
      .join(', ');
  }
  if (lead.services && lead.services.length > 0) {
    return lead.services.map((s) => s.name).join(', ');
  }
  return '—';
}

type LeadDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const { id } = use(params);
  if (searchParams) use(searchParams);

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activity');
  const [editOpen, setEditOpen] = useState(false);
  const [createEmailOpen, setCreateEmailOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [convertMessage, setConvertMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [converting, setConverting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [allProducts, setAllProducts] = useState<InterestItemLite[]>([]);
  const [allServices, setAllServices] = useState<InterestItemLite[]>([]);
  const [partnerCompanies, setPartnerCompanies] = useState<CompanyCatalogLite[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/leads/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLead(data))
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatalogLoading(true);
        const [pRes, sRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/services'),
        ]);
        if (!pRes.ok || !sRes.ok) return;
        const [pJson, sJson] = await Promise.all([pRes.json(), sRes.json()]);
        if (cancelled) return;
        const products: InterestItemLite[] = Array.isArray(pJson)
          ? (pJson as unknown[])
              .map((p) => {
                if (!p || typeof p !== 'object') return null;
                const obj = p as Record<string, unknown>;
                const id = typeof obj.id === 'string' ? obj.id : String(obj.id ?? '');
                const name =
                  typeof obj.name === 'string' ? obj.name : String(obj.name ?? '');
                return { id, name } satisfies InterestItemLite;
              })
              .filter((p): p is InterestItemLite => !!p && !!p.id && !!p.name)
          : [];
        const services: InterestItemLite[] = Array.isArray(sJson)
          ? (sJson as unknown[])
              .map((s) => {
                if (!s || typeof s !== 'object') return null;
                const obj = s as Record<string, unknown>;
                const id = typeof obj.id === 'string' ? obj.id : String(obj.id ?? '');
                const name =
                  typeof obj.name === 'string' ? obj.name : String(obj.name ?? '');
                return { id, name } satisfies InterestItemLite;
              })
              .filter((s): s is InterestItemLite => !!s && !!s.id && !!s.name)
          : [];
        setAllProducts(products);
        setAllServices(services);

        const companiesRes = await fetch('/api/companies/catalog');
        if (!companiesRes.ok) return;
        const companiesJson = await companiesRes.json();
        if (cancelled) return;
        const companies: CompanyCatalogLite[] = Array.isArray(companiesJson)
          ? (companiesJson as unknown[])
              .map((company) => {
                if (!company || typeof company !== 'object') return null;
                const obj = company as Record<string, unknown>;
                const id = typeof obj.id === 'string' ? obj.id : String(obj.id ?? '');
                const name = typeof obj.name === 'string' ? obj.name : String(obj.name ?? '');

                const productsRaw = Array.isArray(obj.products) ? obj.products : [];
                const servicesRaw = Array.isArray(obj.services) ? obj.services : [];
                const parsedProducts: InterestItemLite[] = productsRaw
                  .map((p) => {
                    if (!p || typeof p !== 'object') return null;
                    const item = p as Record<string, unknown>;
                    const itemId =
                      typeof item.id === 'string' ? item.id : String(item.id ?? '');
                    const itemName =
                      typeof item.name === 'string'
                        ? item.name
                        : String(item.name ?? '');
                    return itemId && itemName ? { id: itemId, name: itemName } : null;
                  })
                  .filter((p): p is InterestItemLite => !!p);
                const parsedServices: InterestItemLite[] = servicesRaw
                  .map((s) => {
                    if (!s || typeof s !== 'object') return null;
                    const item = s as Record<string, unknown>;
                    const itemId =
                      typeof item.id === 'string' ? item.id : String(item.id ?? '');
                    const itemName =
                      typeof item.name === 'string'
                        ? item.name
                        : String(item.name ?? '');
                    return itemId && itemName ? { id: itemId, name: itemName } : null;
                  })
                  .filter((s): s is InterestItemLite => !!s);

                return id && name
                  ? ({ id, name, products: parsedProducts, services: parsedServices } satisfies CompanyCatalogLite)
                  : null;
              })
              .filter((company): company is CompanyCatalogLite => !!company)
          : [];
        setPartnerCompanies(companies);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedInterests = useMemo(() => {
    if (!lead) {
      return {
        products: {} as Record<string, number>,
        services: {} as Record<string, number>,
        customProducts: [] as string[],
        customServices: [] as string[],
      };
    }
    const customProducts: string[] = [];
    const customServices: string[] = [];
    const productFromPivot =
      lead.productInterests && lead.productInterests.length > 0
        ? Object.fromEntries(
            lead.productInterests
              .map((i) => {
                if (i.product?.id) return [i.product.id, i.estimatedValue] as const;
                if (i.customName) {
                  customProducts.push(i.customName);
                  return [makeCustomKey('product', i.customName), i.estimatedValue] as const;
                }
                return null;
              })
              .filter((entry): entry is readonly [string, number] => !!entry),
          )
        : {};
    const serviceFromPivot =
      lead.serviceInterests && lead.serviceInterests.length > 0
        ? Object.fromEntries(
            lead.serviceInterests
              .map((i) => {
                if (i.service?.id) return [i.service.id, i.estimatedValue] as const;
                if (i.customName) {
                  customServices.push(i.customName);
                  return [makeCustomKey('service', i.customName), i.estimatedValue] as const;
                }
                return null;
              })
              .filter((entry): entry is readonly [string, number] => !!entry),
          )
        : {};

    const productFallback =
      Object.keys(productFromPivot).length > 0
        ? {}
        : Object.fromEntries((lead.products ?? []).map((p) => [p.id, 0]));

    const serviceFallback =
      Object.keys(serviceFromPivot).length > 0
        ? {}
        : Object.fromEntries((lead.services ?? []).map((s) => [s.id, 0]));

    return {
      products: { ...productFallback, ...productFromPivot } as Record<
        string,
        number
      >,
      services: { ...serviceFallback, ...serviceFromPivot } as Record<
        string,
        number
      >,
      customProducts,
      customServices,
    };
  }, [lead]);

  const hasPivotInterests = useMemo(() => {
    if (!lead) return false;
    return (
      (lead.productInterests?.length ?? 0) > 0 ||
      (lead.serviceInterests?.length ?? 0) > 0
    );
  }, [lead]);

  if (loading) {
    return (
      <DashboardShell>
          <div className='flex-1 flex flex-col gap-4 mt-2'>
            {/* Skeleton : bandeau Détails du lead + cycle de vie */}
            <NeumoCard className='p-4'>
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between'>
                  <SkeletonLoader className='h-4 w-32' />
                  <SkeletonLoader className='h-4 w-40' />
                </div>
                <div className='flex w-full gap-1 rounded-xl overflow-hidden'>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonLoader key={i} className='flex-1 h-9' />
                  ))}
                </div>
              </div>
            </NeumoCard>

            <div className='flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4'>
              {/* Colonne gauche - Profil */}
              <div className='lg:col-span-4 flex flex-col gap-4'>
                <SkeletonLoader className='h-4 w-28' />
                <NeumoCard className='p-4 flex flex-col gap-4'>
                  <div className='flex flex-col items-center gap-3'>
                    <SkeletonLoader className='w-20 h-20 rounded-full shrink-0' />
                    <div className='flex flex-col items-center gap-2 w-full'>
                      <SkeletonLoader className='h-5 w-40' />
                      <SkeletonLoader className='h-3 w-24' />
                    </div>
                    <div className='flex items-center gap-2'>
                      {[1, 2, 3, 4].map((i) => (
                        <SkeletonLoader
                          key={i}
                          className='w-9 h-9 rounded-full'
                        />
                      ))}
                    </div>
                    <SkeletonLoader className='w-full h-9 rounded-xl' />
                    <SkeletonLoader className='h-3 w-36' />
                  </div>
                  <div className='border-t border-gray-100 pt-4 space-y-2'>
                    <div className='flex gap-2'>
                      <SkeletonLoader className='h-4 w-20' />
                      <SkeletonLoader className='h-4 w-16' />
                    </div>
                    <div className='space-y-3'>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className='flex justify-between gap-2'>
                          <SkeletonLoader className='h-3 w-16' />
                          <SkeletonLoader className='h-3 flex-1 max-w-32' />
                        </div>
                      ))}
                    </div>
                  </div>
                </NeumoCard>
              </div>

              {/* Colonne centrale - Activités */}
              <div className='lg:col-span-5 flex flex-col gap-4'>
                <NeumoCard className='p-4 flex flex-col gap-4 flex-1'>
                  <SkeletonLoader className='h-9 w-full rounded-full' />
                  <div className='flex flex-wrap gap-1.5'>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <SkeletonLoader
                        key={i}
                        className='h-7 w-16 rounded-full'
                      />
                    ))}
                  </div>
                  <div className='flex-1 min-h-[200px] space-y-3'>
                    <SkeletonLoader className='h-4 w-full' />
                    <SkeletonLoader className='h-4 w-3/4' />
                    <SkeletonLoader className='h-4 w-1/2' />
                    <SkeletonLoader className='h-12 w-full rounded-xl' />
                    <SkeletonLoader className='h-12 w-full rounded-xl' />
                  </div>
                </NeumoCard>
              </div>

              {/* Colonne droite - Entreprise, Deals */}
              <div className='lg:col-span-3 flex flex-col gap-4'>
                <NeumoCard className='p-4 flex flex-col gap-3'>
                  <SkeletonLoader className='h-4 w-24' />
                  <div className='flex items-center gap-2'>
                    <SkeletonLoader className='w-10 h-10 rounded-lg' />
                    <div className='flex flex-col gap-2 flex-1'>
                      <SkeletonLoader className='h-3 w-28' />
                      <SkeletonLoader className='h-3 w-36' />
                      <SkeletonLoader className='h-3 w-24' />
                    </div>
                  </div>
                </NeumoCard>
                <NeumoCard className='p-4 flex flex-col gap-3'>
                  <div className='flex justify-between'>
                    <SkeletonLoader className='h-4 w-16' />
                    <SkeletonLoader className='h-3 w-6' />
                  </div>
                  <SkeletonLoader className='w-full h-9 rounded-xl' />
                </NeumoCard>
                <NeumoCard className='p-4 flex flex-col gap-3'>
                  <SkeletonLoader className='h-4 w-28' />
                  <SkeletonLoader className='h-4 w-full' />
                </NeumoCard>
              </div>
            </div>
          </div>
      </DashboardShell>
    );
  }

  if (!lead) {
    return (
      <DashboardShell>
          <div className='flex-1 flex flex-col items-center justify-center gap-4'>
            <p className='text-sm text-gray-500'>Lead introuvable.</p>
            <Link
              href='/leads'
              className='inline-flex items-center gap-2 text-primary text-sm font-medium'
            >
              <ArrowLeft className='w-4 h-4' /> Retour aux leads
            </Link>
          </div>
      </DashboardShell>
    );
  }

  const leadAsLead: Lead = {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    source: lead.source,
    notes: lead.notes,
    companyName: lead.companyName ?? lead.company?.name,
    jobTitle: lead.jobTitle,
    location: lead.location,
    activitySector: lead.activitySector,
    activityDomains: lead.activityDomains ?? [],
    civility: lead.civility,
  };

  const initials =
    `${lead.firstName[0] || ''}${lead.lastName[0] || ''}`.toUpperCase();
  const lastActivity = lead.activities[0];

  const productNames = leadProductInterestSummary(lead);
  const serviceNames = leadServiceInterestSummary(lead);

  const currentStageIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.key === lead.status,
  );
  const completedIndex = currentStageIndex >= 0 ? currentStageIndex : -1;

  const currentTabConfig = ACTIVITY_TABS.find((t) => t.key === activeTab);
  const currentFilterType = currentTabConfig?.filterType;

  const activitiesForCurrentFilter =
    currentFilterType && currentFilterType !== 'ALL'
      ? lead.activities.filter((a) => a.type === currentFilterType)
      : lead.activities;

  const handleLoadMoreActivities = async () => {
    if (!lead) return;
    // Onglet Agenda : pagination gérée par un autre composant
    if (activeTab === 'agenda') return;

    const tabConfig = ACTIVITY_TABS.find((t) => t.key === activeTab);
    const filterType = tabConfig?.filterType ?? 'ALL';

    const alreadyLoadedCount =
      filterType && filterType !== 'ALL'
        ? lead.activities.filter((a) => a.type === filterType).length
        : lead.activities.length;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        skip: String(alreadyLoadedCount),
        take: '20',
      });
      if (filterType && filterType !== 'ALL') {
        params.set('filterType', filterType);
      }

      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/activities?${params.toString()}`,
      );
      if (!res.ok) return;

      const payload: {
        activities: Activity[];
        total: number;
        hasMore: boolean;
      } = await res.json();

      setLead((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.activities.map((a) => a.id));
        const merged = [...prev.activities];
        for (const a of payload.activities) {
          if (!existingIds.has(a.id)) {
            merged.push(a);
          }
        }
        merged.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        return {
          ...prev,
          activities: merged,
          totalActivities:
            typeof payload.total === 'number'
              ? payload.total
              : prev.totalActivities,
          hasMoreActivities:
            typeof payload.hasMore === 'boolean'
              ? payload.hasMore
              : prev.hasMoreActivities,
        };
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <DashboardShell>
        {/* Section Détails du lead - Cycle de vie */}
        <NeumoCard className='p-4 mt-2'>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-primary'>
                Détails du lead
              </h2>
              <div className='flex items-center gap-2 text-[11px] text-gray-500'>
                <span>
                  Étape du cycle : {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
                <ChevronDown className='w-4 h-4' />
              </div>
            </div>
            <div className='flex w-full rounded-xl overflow-hidden bg-gray-100'>
              {LIFECYCLE_STAGES.map((stage, idx) => {
                const isCompleted = idx <= completedIndex;
                return (
                  <div
                    key={stage.key}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 px-2 text-[10px] font-medium border-r border-white/50 last:border-r-0 ${
                      isCompleted
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isCompleted && <Check className='w-3.5 h-3.5 shrink-0' />}
                    <span className='truncate'>{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </NeumoCard>

        <div className='flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4'>
          {/* Colonne gauche - Profil & infos */}
          <div className='lg:col-span-4 flex flex-col gap-4'>
            <Link
              href='/leads'
              className='inline-flex items-center gap-2 text-[11px] text-gray-500 hover:text-primary'
            >
              <ArrowLeft className='w-3.5 h-3.5' /> Retour aux leads
            </Link>

            <NeumoCard className='p-4 flex flex-col gap-4'>
              <div className='flex flex-col items-center gap-3'>
                <div className='w-20 h-20 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-semibold shadow-neu'>
                  {initials}
                </div>
                <div className='text-center'>
                  <h1 className='text-lg font-semibold text-primary'>
                    {lead.firstName} {lead.lastName}
                  </h1>
                  <p className='text-[11px] text-gray-500'>
                    {lead.companyName ?? lead.company?.name ?? '—'}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setEditOpen(true)}
                    className='px-4 py-2 rounded-full bg-primary text-white text-xs font-medium shadow-neu hover:brightness-105 transition'
                  >
                    Modifier
                  </button>
                </div>
                {lead.status === 'CONVERTED' ? (
                  <div className='w-full py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium text-center border border-gray-200'>
                    Déjà client
                  </div>
                ) : (
                  <button
                    type='button'
                    disabled={converting || !hasPivotInterests}
                    onClick={async () => {
                      setConvertMessage(null);
                      if (lead.status === 'CONVERTED') {
                        setConvertMessage({
                          type: 'error',
                          text: 'Ce prospect est déjà enregistré comme client.',
                        });
                        setTimeout(() => setConvertMessage(null), 5000);
                        return;
                      }
                      if (!hasPivotInterests) {
                        setConvertMessage({
                          type: 'error',
                          text: CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE,
                        });
                        setTimeout(() => setConvertMessage(null), 5000);
                        return;
                      }
                      setConverting(true);
                      try {
                        const res = await fetch('/api/clients', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadId: lead.id }),
                        });
                        const body = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setConvertMessage({
                            type: 'error',
                            text:
                              typeof body.error === 'string'
                                ? body.error
                                : 'Impossible de convertir ce prospect en client.',
                          });
                          setTimeout(() => setConvertMessage(null), 5000);
                          return;
                        }
                        setLead((prev) =>
                          prev
                            ? {
                                ...prev,
                                status: (body.lead?.status ??
                                  'CONVERTED') as string,
                              }
                            : prev,
                        );
                        setConvertMessage({
                          type: 'success',
                          text: 'Prospect converti en client avec succès.',
                        });
                        setTimeout(() => setConvertMessage(null), 5000);
                        // Rafraîchir les objectifs sur le dashboard (Mon objectif)
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('crm:goals-invalidate'),
                          );
                        }
                      } catch (e) {
                        setConvertMessage({
                          type: 'error',
                          text: 'Une erreur est survenue lors de la conversion.',
                        });
                        setTimeout(() => setConvertMessage(null), 5000);
                      } finally {
                        setConverting(false);
                      }
                    }}
                    className='w-full py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-neu hover:brightness-105 transition disabled:opacity-60'
                  >
                    {converting ? 'Conversion...' : 'Convertir en client'}
                  </button>
                )}
                {!hasPivotInterests && lead.status !== 'CONVERTED' && (
                  <p className='text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl'>
                    La conversion est impossible tant qu&apos;aucun intérêt n&apos;est
                    enregistré via le bloc{' '}
                    <a
                      href='#lead-interests-estimation'
                      className='font-medium underline underline-offset-2 hover:text-amber-900'
                    >
                      Intérêts & estimation
                    </a>
                    {' '}
                    (au moins un produit ou un service avec montant, puis Enregistrer).
                  </p>
                )}
                {convertMessage && (
                  <p
                    className={`text-[11px] px-3 py-2 rounded-xl ${
                      convertMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {convertMessage.text}
                  </p>
                )}
                {lastActivity && (
                  <p className='text-[10px] text-gray-400'>
                    Dernière activité :{' '}
                    {new Date(lastActivity.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>

              <div className='border-t border-gray-100 pt-4 space-y-2'>
                <div className='flex gap-2 border-b border-gray-100'>
                  <button
                    type='button'
                    className='pb-2 text-[11px] font-medium text-primary border-b-2 border-primary'
                  >
                    Infos lead
                  </button>
                  <button
                    type='button'
                    className='pb-2 text-[11px] font-medium text-gray-500'
                  >
                    Adresse
                  </button>
                </div>
                <div className='space-y-2 text-[11px]'>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>Email</span>
                    <span className='text-gray-700'>{lead.email ?? '—'}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>Téléphone</span>
                    <span className='text-gray-700'>{lead.phone ?? '—'}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>
                      Secteur d&apos;activités
                    </span>
                    <span className='text-gray-700'>
                      {lead.activitySector ?? '—'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>
                      Domaine d&apos;activités
                    </span>
                    <span className='text-gray-700'>
                      {lead.activityDomains?.length
                        ? lead.activityDomains.join(', ')
                        : '—'}
                    </span>
                  </div>
                  <div className='flex justify-between items-center gap-2'>
                    <span className='text-gray-500'>Statut</span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium ${
                        STATUS_STYLES[lead.status] ??
                        'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>Poste / Fonction</span>
                    <span className='text-gray-700'>{lead.jobTitle ?? '—'}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>Localisation</span>
                    <span className='text-gray-700'>
                      {lead.location ?? '—'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-500'>Source</span>
                    <span className='text-gray-700'>{lead.source ?? '—'}</span>
                  </div>
                  <div className='mt-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 px-3 py-2.5 space-y-1'>
                    <p className='text-[10px] font-semibold text-indigo-600 uppercase tracking-wide'>
                      Intérêt produits & services
                    </p>
                    <div className='flex flex-col gap-1.5 text-[11px]'>
                      <div className='flex gap-2'>
                        <span className='text-gray-500 whitespace-nowrap'>
                          Produits :
                        </span>
                        <span className='text-indigo-900 font-medium'>
                          {productNames}
                        </span>
                      </div>
                      <div className='flex gap-2'>
                        <span className='text-gray-500 whitespace-nowrap'>
                          Services :
                        </span>
                        <span className='text-indigo-900 font-medium'>
                          {serviceNames}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NeumoCard>

            <div id='lead-interests-estimation'>
            <LeadInterestsEstimatorCard
              key={`${lead.id}:${JSON.stringify(savedInterests)}`}
              products={allProducts}
              services={allServices}
              partnerCompanies={partnerCompanies}
              customProducts={savedInterests.customProducts}
              customServices={savedInterests.customServices}
              initialSaved={savedInterests}
              disabled={catalogLoading || lead.status === 'CONVERTED'}
              onSave={async (items: InterestsPayloadItem[]) => {
                try {
                  const res = await fetch(
                    `/api/leads/${encodeURIComponent(lead.id)}/interests`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ items }),
                    },
                  );
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    return {
                      ok: false as const,
                      error:
                        typeof body.error === 'string'
                          ? body.error
                          : "Impossible d'enregistrer les intérêts.",
                    };
                  }

                  const refreshed = await fetch(`/api/leads/${lead.id}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .catch(() => null);
                  if (refreshed) setLead(refreshed);

                  return {
                    ok: true as const,
                    message: typeof body.message === 'string' ? body.message : undefined,
                    counts: body.counts,
                  };
                } catch {
                  return {
                    ok: false as const,
                    error: "Une erreur est survenue lors de l'enregistrement.",
                  };
                }
              }}
            />
            </div>
          </div>

          {/* Colonne centrale - Activités */}
          <div className='lg:col-span-5 flex flex-col gap-4'>
            <NeumoCard className='p-4 flex flex-col gap-4 flex-1'>
              <div className='flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100 text-xs w-full'>
                <Search className='w-4 h-4 text-gray-400' />
                <input
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder='Rechercher activités, notes, emails...'
                  className='bg-transparent outline-none flex-1 text-[11px] text-gray-700'
                />
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {ACTIVITY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type='button'
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-primary text-white shadow-neu'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === 'agenda' ? (
                <AgendaTab leadId={lead.id} />
              ) : (
                <div className='flex-1 min-h-[200px] overflow-y-auto'>
                  {activeTab === 'emails' ? (
                    <EmailsTabContent
                      emails={lead.activities.filter((a) => a.type === 'EMAIL')}
                      loading={false}
                      recipientName={`${lead.firstName} ${lead.lastName}`}
                      recipientEmail={lead.email ?? ''}
                      onCreateEmail={() => setCreateEmailOpen(true)}
                      onEmailAdded={(a) =>
                        setLead((prev) =>
                          prev
                            ? { ...prev, activities: [a, ...prev.activities] }
                            : prev,
                        )
                      }
                    />
                  ) : activeTab === 'meetings' ? (
                    <MeetingsTabContent
                      meetings={lead.activities.filter(
                        (a) => a.type === 'MEETING',
                      )}
                      loading={false}
                      leadId={lead.id}
                      leadName={`${lead.firstName} ${lead.lastName}`}
                      onCreateSuccess={(a) =>
                        setLead((prev) =>
                          prev
                            ? { ...prev, activities: [a, ...prev.activities] }
                            : prev,
                        )
                      }
                      onRescheduleSuccess={(a) =>
                        setLead((prev) => {
                          if (!prev) return prev;
                          const updated = prev.activities.map((act) =>
                            act.id === a.id ? { ...act, ...a } : act,
                          );
                          updated.sort(
                            (x, y) =>
                              new Date(y.date).getTime() -
                              new Date(x.date).getTime(),
                          );
                          return { ...prev, activities: updated };
                        })
                      }
                      onUpdateSuccess={(a) =>
                        setLead((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            activities: prev.activities.map((act) =>
                              act.id === a.id ? { ...act, ...a } : act,
                            ),
                          };
                        })
                      }
                    />
                  ) : (
                    <InteractionHistory
                      lead={leadAsLead}
                      activities={lead.activities}
                      filterType={
                        ACTIVITY_TABS.find((t) => t.key === activeTab)?.filterType
                      }
                      title={
                        activeTab === 'calls' ? 'Journal des appels' : undefined
                      }
                      initialType={activeTab === 'calls' ? 'CALL' : undefined}
                      onActivityAdded={(a) =>
                        setLead((prev) =>
                          prev
                            ? { ...prev, activities: [a, ...prev.activities] }
                            : prev,
                        )
                      }
                    />
                  )}
                </div>
              )}
              {activeTab !== 'agenda' && lead.hasMoreActivities && (
                <div className='mt-3 flex justify-center'>
                  <button
                    type='button'
                    onClick={handleLoadMoreActivities}
                    disabled={loadingMore}
                    className='px-4 py-1.5 rounded-full text-[11px] bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 disabled:opacity-60'
                  >
                    {loadingMore ? 'Chargement...' : 'Charger plus'}
                  </button>
                </div>
              )}
            </NeumoCard>
          </div>

          {/* Colonne droite - Société + Deals */}
          <div className='lg:col-span-3 flex flex-col gap-4'>
            <NeumoCard className='p-4 flex flex-col gap-3'>
              <h3 className='text-xs font-semibold text-primary'>Entreprise</h3>
              <div className='flex items-center gap-2'>
                <div className='w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center'>
                  <Building2 className='w-5 h-5 text-gray-500' />
                </div>
                <div>
                  <p className='text-xs font-medium text-primary'>
                    {lead.company?.name ?? '—'}
                  </p>
                  <p className='text-[10px] text-gray-500'>
                    {lead.email ?? '—'}
                  </p>
                  <p className='text-[10px] text-gray-500'>
                    {lead.phone ?? '—'}
                  </p>
                </div>
              </div>
            </NeumoCard>

            <NeumoCard className='p-4 flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <h3 className='text-xs font-semibold text-primary'>Deals</h3>
                <span className='text-[10px] text-gray-400'>0</span>
              </div>
              <button
                type='button'
                className='w-full py-2 rounded-xl border border-dashed border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50'
              >
                + Créer un deal
              </button>
            </NeumoCard>

            <LeadAttachmentsBlock leadId={lead.id} />
          </div>
        </div>

      <LeadEditSheet
        open={editOpen}
        lead={leadAsLead}
        onClose={() => setEditOpen(false)}
        onUpdated={(updated) =>
          setLead((prev) => (prev ? { ...prev, ...updated } : prev))
        }
      />

      <CreateEmailModal
        open={createEmailOpen}
        leadId={lead.id}
        recipientName={`${lead.firstName} ${lead.lastName}`}
        recipientEmail={lead.email ?? ''}
        onClose={() => setCreateEmailOpen(false)}
        onSent={(activity) =>
          setLead((prev) =>
            prev
              ? { ...prev, activities: [activity, ...prev.activities] }
              : prev,
          )
        }
      />
    </DashboardShell>
  );
}
