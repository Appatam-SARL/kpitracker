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
import { formatDecisionRoleLabel, formatLeadTypeLabel } from '@/config/lead-options';
import {
  formatBiimYesNo,
  normalizeBiimDocuments,
} from '@/config/biim-contact-fields';
import {
  NEGOTIATION_STAGE_FIELD_LABEL,
  NEGOTIATION_STAGE_LABELS,
  NEGOTIATION_STAGE_ORDER,
  NEGOTIATION_STAGE_STYLES,
  mapLegacyLeadStatusToNegotiationStage,
} from '@/config/negotiation-stage';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
} from 'lucide-react';
import { CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE } from '@/lib/lead-conversion';
import Link from 'next/link';
import { useEffect, useMemo, useState, use } from 'react';

const LIFECYCLE_STAGES = NEGOTIATION_STAGE_ORDER.map((key) => ({
  key,
  label: NEGOTIATION_STAGE_LABELS[key],
}));

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
  contactId: string;
  prospectId: string;
  decisionRole?: string | null;
  canEdit?: boolean;
  isMine?: boolean;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  geographicSituation?: string | null;
  activitySector?: string | null;
  activityDomains?: string[];
  notes?: string | null;
  civility?: string | null;
  leadType?: string | null;
  status: string;
  biimDocuments?: string[];
  biimRegistered?: boolean | null;
  biimVisited?: boolean | null;
  biimApproved?: boolean | null;
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

function normalizeCustomName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

function makeCustomKey(kind: 'product' | 'service', customName: string) {
  return `custom:${kind}:${normalizeCustomName(customName)}`;
}

type LeadDetailPageProps = {
  params: Promise<{ id: string; contactId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function ContactProspectingPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const { id: prospectId, contactId } = use(params);
  if (searchParams) use(searchParams);

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
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
    if (!prospectId || !contactId) return;
    setAccessDenied(false);
    fetch(`/api/prospects/${prospectId}/contacts/${contactId}`)
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => setLead(data))
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [prospectId, contactId]);

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
      <DashboardShell
        title='Fiche de prospection'
        subtitle='Chargement…'
      >
        <div className='flex-1 flex flex-col gap-4 mt-2'>
          <SkeletonLoader className='h-4 w-36' />

          <NeumoCard className='p-5'>
            <div className='flex flex-col sm:flex-row gap-4'>
              <SkeletonLoader className='w-16 h-16 rounded-full shrink-0' />
              <div className='flex-1 space-y-3'>
                <SkeletonLoader className='h-5 w-48' />
                <SkeletonLoader className='h-3 w-32' />
                <SkeletonLoader className='h-3 w-40' />
                <div className='flex flex-wrap gap-2 pt-1'>
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonLoader key={i} className='h-8 w-24 rounded-full' />
                  ))}
                </div>
                <div className='flex flex-wrap gap-2 pt-2'>
                  {[1, 2, 3].map((i) => (
                    <SkeletonLoader key={i} className='h-8 w-28 rounded-full' />
                  ))}
                </div>
              </div>
            </div>
          </NeumoCard>

          <div className='flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4'>
            <div className='lg:col-span-4 flex flex-col gap-4'>
              <NeumoCard className='p-4 space-y-3'>
                <SkeletonLoader className='h-4 w-28' />
                {[1, 2, 3].map((i) => (
                  <div key={i} className='flex justify-between gap-2'>
                    <SkeletonLoader className='h-3 w-16' />
                    <SkeletonLoader className='h-3 flex-1 max-w-32' />
                  </div>
                ))}
              </NeumoCard>
              <NeumoCard className='p-4'>
                <SkeletonLoader className='h-24 w-full rounded-xl' />
              </NeumoCard>
            </div>
            <div className='lg:col-span-5'>
              <NeumoCard className='p-4 flex flex-col gap-4 flex-1'>
                <SkeletonLoader className='h-9 w-full rounded-full' />
                <div className='flex flex-wrap gap-1.5'>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <SkeletonLoader key={i} className='h-7 w-16 rounded-full' />
                  ))}
                </div>
                <SkeletonLoader className='h-32 w-full rounded-xl' />
              </NeumoCard>
            </div>
            <div className='lg:col-span-3 flex flex-col gap-4'>
              <NeumoCard className='p-4 space-y-3'>
                <SkeletonLoader className='h-4 w-24' />
                <SkeletonLoader className='h-3 w-36' />
                <SkeletonLoader className='h-3 w-28' />
                <SkeletonLoader className='h-3 w-32' />
              </NeumoCard>
              <NeumoCard className='p-4'>
                <SkeletonLoader className='h-16 w-full rounded-xl' />
              </NeumoCard>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!lead) {
    return (
      <DashboardShell
        title='Fiche de prospection'
        subtitle={accessDenied ? 'Accès refusé' : 'Contact introuvable'}
      >
        <div className='flex-1 flex flex-col items-center justify-center gap-4'>
          <p className='text-sm text-gray-500'>
            {accessDenied
              ? 'Vous ne pouvez ouvrir que la fiche de vos propres contacts.'
              : 'Fiche contact introuvable.'}
          </p>
          <Link
            href={`/leads/${prospectId}`}
            className='inline-flex items-center gap-2 text-primary text-sm font-medium'
          >
            <ArrowLeft className='w-4 h-4' /> Retour à l&apos;entreprise
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
    geographicSituation: lead.geographicSituation,
    activitySector: lead.activitySector,
    activityDomains: lead.activityDomains ?? [],
    civility: lead.civility,
    leadType: lead.leadType,
    decisionRole: lead.decisionRole,
    prospectId: lead.prospectId,
    contactId: lead.contactId || lead.id,
  };

  const initials =
    `${lead.firstName[0] || ''}${lead.lastName[0] || ''}`.toUpperCase();
  const lastActivity = lead.activities[0];

  const negotiationStage = mapLegacyLeadStatusToNegotiationStage(lead.status);

  const updateNegotiationStage = async (
    stageKey: (typeof NEGOTIATION_STAGE_ORDER)[number],
  ) => {
    if (lead.canEdit === false || stageKey === negotiationStage) return;
    const previous = negotiationStage;
    setLead((prev) => (prev ? { ...prev, status: stageKey } : prev));
    try {
      const res = await fetch(
        `/api/prospects/${prospectId}/contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ negotiationStage: stageKey }),
        },
      );
      if (!res.ok) {
        setLead((prev) => (prev ? { ...prev, status: previous } : prev));
      }
    } catch {
      setLead((prev) => (prev ? { ...prev, status: previous } : prev));
    }
  };

  const companyLabel = lead.companyName ?? lead.company?.name ?? 'Entreprise';
  const displayName = `${lead.civility ? `${lead.civility} ` : ''}${lead.firstName} ${lead.lastName}`.trim();
  const shellSubtitle = `${displayName} · ${companyLabel}`;
  const canChangeStage = lead.canEdit !== false;

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
        `/api/activities?leadId=${encodeURIComponent(lead.prospectId)}&contactId=${encodeURIComponent(lead.contactId || lead.id)}&${params.toString()}`,
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
    <DashboardShell
      title='Fiche de prospection'
      subtitle={shellSubtitle}
    >
      <div className='flex-1 flex flex-col gap-4 mt-2'>
        <Link
          href={`/leads/${prospectId}`}
          className='inline-flex items-center gap-2 text-[11px] text-gray-500 hover:text-primary w-fit'
        >
          <ArrowLeft className='w-3.5 h-3.5' /> Retour à l&apos;entreprise
        </Link>

        {/* Hero identité + actions + stade */}
        <NeumoCard className='p-5'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col sm:flex-row gap-4 sm:items-start'>
              <div className='w-16 h-16 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xl font-semibold shadow-neu shrink-0'>
                {initials}
              </div>

              <div className='flex-1 min-w-0 space-y-2'>
                <div>
                  <h1 className='text-lg font-semibold text-primary truncate'>
                    {displayName}
                  </h1>
                  {lead.jobTitle ? (
                    <p className='text-xs text-gray-600 flex items-center gap-1.5 mt-0.5'>
                      <Briefcase className='w-3.5 h-3.5 shrink-0 text-gray-400' />
                      <span className='truncate'>{lead.jobTitle}</span>
                    </p>
                  ) : null}
                  <Link
                    href={`/leads/${prospectId}`}
                    className='text-[11px] text-gray-500 hover:text-primary inline-flex items-center gap-1.5 mt-1'
                  >
                    <Building2 className='w-3.5 h-3.5 shrink-0' />
                    <span className='truncate'>{companyLabel}</span>
                  </Link>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-100 hover:border-primary/30 hover:text-primary transition'
                      title={lead.email}
                    >
                      <Mail className='w-3.5 h-3.5' />
                      Email
                    </a>
                  ) : null}
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-100 hover:border-primary/30 hover:text-primary transition'
                      title={lead.phone}
                    >
                      <Phone className='w-3.5 h-3.5' />
                      Appeler
                    </a>
                  ) : null}
                  {lead.canEdit !== false && (
                    <button
                      type='button'
                      onClick={() => setEditOpen(true)}
                      className='px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-medium shadow-neu hover:brightness-105 transition'
                    >
                      Modifier
                    </button>
                  )}
                  {lead.isMine === false ? null : negotiationStage ===
                    'VENTE_CONCLUE' ? (
                    <span className='px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium border border-gray-200'>
                      Déjà client
                    </span>
                  ) : (
                    <button
                      type='button'
                      disabled={converting || !hasPivotInterests}
                      onClick={async () => {
                        setConvertMessage(null);
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
                            body: JSON.stringify({
                              contactId: lead.contactId || lead.id,
                            }),
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
                                    'VENTE_CONCLUE') as string,
                                }
                              : prev,
                          );
                          setConvertMessage({
                            type: 'success',
                            text: 'Prospect converti en client avec succès.',
                          });
                          setTimeout(() => setConvertMessage(null), 5000);
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new CustomEvent('crm:goals-invalidate'),
                            );
                          }
                        } catch {
                          setConvertMessage({
                            type: 'error',
                            text: 'Une erreur est survenue lors de la conversion.',
                          });
                          setTimeout(() => setConvertMessage(null), 5000);
                        } finally {
                          setConverting(false);
                        }
                      }}
                      className='px-3 py-1.5 rounded-full bg-teal-600 text-white text-[11px] font-medium shadow-neu hover:brightness-105 transition disabled:opacity-60'
                    >
                      {converting ? 'Conversion...' : 'Convertir en client'}
                    </button>
                  )}
                </div>

                {lead.isMine === false ? (
                  <p className='text-[10px] text-gray-500'>
                    Contact d&apos;une autre commerciale — consultation seule.
                  </p>
                ) : null}

                {!hasPivotInterests &&
                  negotiationStage !== 'VENTE_CONCLUE' &&
                  lead.isMine !== false && (
                    <p className='text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl'>
                      La conversion est impossible tant qu&apos;aucun intérêt
                      n&apos;est enregistré via le bloc{' '}
                      <a
                        href='#lead-interests-estimation'
                        className='font-medium underline underline-offset-2 hover:text-amber-900'
                      >
                        Intérêts & estimation
                      </a>{' '}
                      (au moins un produit ou un service avec montant, puis
                      Enregistrer).
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
            </div>

            <div className='border-t border-gray-100 pt-4'>
              <p className='text-[10px] font-medium text-gray-500 mb-2'>
                {NEGOTIATION_STAGE_FIELD_LABEL}
              </p>
              <div className='flex flex-wrap gap-2'>
                {LIFECYCLE_STAGES.map((stage) => {
                  const isActive = stage.key === negotiationStage;
                  return (
                    <button
                      key={stage.key}
                      type='button'
                      disabled={!canChangeStage || isActive}
                      onClick={() => updateNegotiationStage(stage.key)}
                      className={`px-3.5 py-2 rounded-full text-[11px] font-medium transition-all ${
                        isActive
                          ? `${NEGOTIATION_STAGE_STYLES[stage.key]} ring-2 ring-offset-1 ring-primary/25 shadow-sm`
                          : 'bg-gray-50 text-gray-400 border border-gray-100'
                      } ${
                        canChangeStage && !isActive
                          ? 'hover:bg-gray-100 hover:text-gray-600 cursor-pointer'
                          : ''
                      } ${!canChangeStage ? 'cursor-default' : ''} ${
                        isActive ? 'cursor-default' : ''
                      }`}
                      aria-pressed={isActive}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </NeumoCard>

        <div className='flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4'>
          {/* Colonne gauche - Coordonnées & intérêts */}
          <div className='lg:col-span-4 flex flex-col gap-4'>
            <NeumoCard className='p-4 flex flex-col gap-3'>
              <h3 className='text-xs font-semibold text-primary flex items-center gap-1.5'>
                <UserRound className='w-3.5 h-3.5' />
                Coordonnées
              </h3>
              <div className='space-y-2.5 text-[11px]'>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-gray-500 shrink-0'>Email</span>
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className='text-primary hover:underline text-right break-all'
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </div>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-gray-500 shrink-0'>Téléphone</span>
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className='text-primary hover:underline text-right'
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </div>
                <div className='flex justify-between items-center gap-2 pt-1'>
                  <span className='text-gray-500 shrink-0'>
                    Rôle dans la décision
                  </span>
                  <span className='inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100'>
                    {formatDecisionRoleLabel(lead.decisionRole)}
                  </span>
                </div>
                {(normalizeBiimDocuments(lead.biimDocuments).length > 0 ||
                  lead.biimRegistered != null ||
                  lead.biimVisited != null ||
                  lead.biimApproved != null) && (
                  <div className='space-y-2 border-t border-gray-100 pt-3'>
                    <p className='text-[10px] font-semibold uppercase tracking-wide text-primary'>
                      Informations BIIM
                    </p>
                    <div className='flex flex-col gap-1.5'>
                      <span className='text-gray-500'>Documents</span>
                      {normalizeBiimDocuments(lead.biimDocuments).length >
                      0 ? (
                        <div className='flex flex-wrap gap-1.5'>
                          {normalizeBiimDocuments(lead.biimDocuments).map(
                            (doc) => (
                              <span
                                key={doc}
                                className='rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600'
                              >
                                {doc}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className='flex justify-between gap-2'>
                      <span className='text-gray-500 shrink-0'>
                        Enregistré sur BIIM
                      </span>
                      <span>{formatBiimYesNo(lead.biimRegistered)}</span>
                    </div>
                    <div className='flex justify-between gap-2'>
                      <span className='text-gray-500 shrink-0'>Visitée</span>
                      <span>{formatBiimYesNo(lead.biimVisited)}</span>
                    </div>
                    <div className='flex justify-between gap-2'>
                      <span className='text-gray-500 shrink-0'>
                        Approuvé par BIIM
                      </span>
                      <span>{formatBiimYesNo(lead.biimApproved)}</span>
                    </div>
                  </div>
                )}
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
                disabled={
                  catalogLoading ||
                  negotiationStage === 'VENTE_CONCLUE' ||
                  lead.isMine === false
                }
                onSave={async (items: InterestsPayloadItem[]) => {
                  try {
                    const res = await fetch(
                      `/api/prospects/${encodeURIComponent(lead.prospectId)}/contacts/${encodeURIComponent(lead.contactId || lead.id)}/interests`,
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

                    const refreshed = await fetch(
                      `/api/prospects/${lead.prospectId}/contacts/${lead.contactId || lead.id}`,
                    )
                      .then((r) => (r.ok ? r.json() : null))
                      .catch(() => null);
                    if (refreshed) setLead(refreshed);

                    return {
                      ok: true as const,
                      message:
                        typeof body.message === 'string'
                          ? body.message
                          : undefined,
                      counts: body.counts,
                    };
                  } catch {
                    return {
                      ok: false as const,
                      error:
                        "Une erreur est survenue lors de l'enregistrement.",
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
                <AgendaTab leadId={lead.prospectId} />
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
                      leadId={lead.prospectId}
                      contactId={lead.contactId || lead.id}
                      leadName={`${lead.firstName} ${lead.lastName}`}
                      onCreateSuccess={(a) =>
                        setLead((prev) =>
                          prev
                            ? { ...prev, activities: [a, ...prev.activities] }
                            : prev,
                        )
                      }
                    />
                  ) : (
                    <InteractionHistory
                      lead={leadAsLead}
                      prospectId={lead.prospectId}
                      contactId={lead.contactId || lead.id}
                      activities={lead.activities}
                      filterType={
                        ACTIVITY_TABS.find((t) => t.key === activeTab)
                          ?.filterType
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

          {/* Colonne droite - Entreprise */}
          <div className='lg:col-span-3 flex flex-col gap-4'>
            <NeumoCard className='p-4 flex flex-col gap-3'>
              <h3 className='text-xs font-semibold text-primary flex items-center gap-1.5'>
                <Building2 className='w-3.5 h-3.5' />
                Entreprise
              </h3>
              <div className='flex items-start gap-2'>
                <div className='w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0'>
                  <Building2 className='w-5 h-5 text-gray-500' />
                </div>
                <div className='min-w-0'>
                  <Link
                    href={`/leads/${prospectId}`}
                    className='text-xs font-medium text-primary hover:underline break-words'
                  >
                    {companyLabel}
                  </Link>
                </div>
              </div>

              <div className='space-y-2.5 text-[11px] border-t border-gray-100 pt-3'>
                <div className='flex justify-between gap-2'>
                  <span className='text-gray-500 shrink-0'>Type</span>
                  <span className='text-gray-700 text-right'>
                    {formatLeadTypeLabel(lead.leadType)}
                  </span>
                </div>
                <div className='flex justify-between gap-2'>
                  <span className='text-gray-500 shrink-0'>Secteur</span>
                  <span className='text-gray-700 text-right'>
                    {lead.activitySector ?? '—'}
                  </span>
                </div>
                <div className='flex flex-col gap-1.5'>
                  <span className='text-gray-500'>Domaines</span>
                  {lead.activityDomains && lead.activityDomains.length > 0 ? (
                    <div className='flex flex-wrap gap-1'>
                      {lead.activityDomains.map((domain) => (
                        <span
                          key={domain}
                          className='inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-100'
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className='text-gray-400'>—</span>
                  )}
                </div>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-gray-500 shrink-0 flex items-center gap-1'>
                    <MapPin className='w-3 h-3' />
                    Quartier, commune, ville, pays
                  </span>
                  <span className='text-gray-700 text-right'>
                    {lead.location ?? '—'}
                  </span>
                </div>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-gray-500 shrink-0'>
                    Situation géographique
                  </span>
                  {lead.geographicSituation ? (
                    <a
                      href={lead.geographicSituation}
                      target='_blank'
                      rel='noreferrer'
                      className='text-primary text-right hover:underline break-all'
                    >
                      Voir la carte
                    </a>
                  ) : (
                    <span className='text-gray-400 text-right'>—</span>
                  )}
                </div>
                <div className='flex justify-between gap-2'>
                  <span className='text-gray-500 shrink-0'>Source</span>
                  <span className='text-gray-700 text-right'>
                    {lead.source ?? '—'}
                  </span>
                </div>
              </div>
            </NeumoCard>

            <LeadAttachmentsBlock
              leadId={lead.prospectId}
              contactId={lead.contactId}
              title='Pièces disponibles'
              listTitle='Documents du contact'
            />
          </div>
        </div>
      </div>

      <LeadEditSheet
        open={editOpen}
        lead={leadAsLead}
        mode='contact'
        onClose={() => setEditOpen(false)}
        onUpdated={() => {
          fetch(`/api/prospects/${prospectId}/contacts/${contactId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) setLead(data);
            })
            .catch(() => null);
        }}
        onDeleted={() => {
          window.location.href = `/leads/${prospectId}`;
        }}
      />

      <CreateEmailModal
        open={createEmailOpen}
        leadId={lead.prospectId}
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
