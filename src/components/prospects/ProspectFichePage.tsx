'use client';

import DashboardShell from '@/components/layouts/DashboardShell';
import LeadAttachmentsBlock from '@/components/lead-attachments/LeadAttachmentsBlock';
import NeumoCard from '@/components/NeumoCard';
import ProspectEditSheet from '@/components/ProspectEditSheet';
import BiimContactFields, {
  emptyBiimContactFormValues,
  getBiimDocumentUploads,
  type BiimContactFormValues,
} from '@/components/BiimContactFields';
import { uploadBiimContactDocuments } from '@/lib/upload-biim-documents';
import { normalizeBiimDocuments } from '@/config/biim-contact-fields';
import SkeletonLoader from '@/components/SkeletonLoader';
import { Field } from '@/components/ui/field';
import {
  DEFAULT_CIVILITIES,
  formatLeadTypeLabel,
  DECISION_ROLE_OPTIONS,
  formatDecisionRoleLabel,
} from '@/config/lead-options';
import {
  formatBiimYesNo,
  isBiimCompanyName,
} from '@/config/biim-contact-fields';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatNegotiationStageLabel,
  NEGOTIATION_STAGE_FIELD_LABEL,
  NEGOTIATION_STAGE_STYLES,
} from '@/config/negotiation-stage';
import {
  normalizeProspectSocialLinks,
  type ProspectSocialLink,
} from '@/config/prospect-socials';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  Twitter,
  UserPlus,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

export type ProspectFichePageProps = {
  backHref?: string;
  backLabel?: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  civility?: string | null;
  jobTitle?: string | null;
  decisionRole?: string | null;
  negotiationStage?: string | null;
  biimDocuments?: string[];
  biimRegistered?: boolean | null;
  biimVisited?: boolean | null;
  biimApproved?: boolean | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  canEdit?: boolean;
  canViewFiche?: boolean;
  isMine?: boolean;
};

type ProspectDetail = {
  id: string;
  name: string;
  leadType: string;
  activitySector?: string | null;
  location?: string | null;
  geographicSituation?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  socialLinks?: ProspectSocialLink[];
  source?: string | null;
  notes?: string | null;
  status: string;
  activityDomains: string[];
  contacts: Contact[];
  createdBy?: { id: string; name: string } | null;
  createdAt?: string;
};

type ActivityItem = {
  id: string;
  type: string;
  content?: string | null;
  date: string;
  user?: { name: string } | null;
};

function contactInitials(contact: Contact) {
  return `${contact.firstName?.[0] ?? ''}${contact.lastName?.[0] ?? ''}`.toUpperCase();
}

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'P';
}

function displayWebsite(url: string) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className='grid grid-cols-[1fr_1.2fr] gap-2 py-2 border-b border-gray-100 last:border-0'>
      <dt className='text-[11px] text-gray-500'>{label}</dt>
      <dd className='text-[12px] text-primary font-medium min-w-0 break-words'>
        {children}
      </dd>
    </div>
  );
}

function socialNetworkIcon(network: string): LucideIcon {
  const n = network.toLowerCase();
  if (n.includes('facebook')) return Facebook;
  if (n.includes('instagram')) return Instagram;
  if (n.includes('linkedin')) return Linkedin;
  if (n.includes('twitter') || n === 'x' || n.startsWith('x ')) return Twitter;
  if (n.includes('youtube')) return Youtube;
  if (n.includes('tiktok')) return Music2;
  if (n.includes('whatsapp')) return MessageCircle;
  return Link2;
}

function ensureHttpUrl(url: string) {
  return url.startsWith('http') ? url : `https://${url}`;
}

function LinkIconButton({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <a
      href={ensureHttpUrl(href)}
      target='_blank'
      rel='noreferrer'
      title={label}
      aria-label={label}
      className='inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-neu-soft transition-colors hover:text-primary hover:border-primary/20'
    >
      <Icon className='h-3.5 w-3.5' />
    </a>
  );
}

export default function ProspectFichePage({
  backHref = '/leads',
  backLabel = 'Retour aux contacts',
}: ProspectFichePageProps) {
  const params = useParams();
  const id = String(params.id ?? '');
  const router = useRouter();
  const { user } = useAuth();
  const isBiimUser = isBiimCompanyName(user?.company?.name);
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [mainTab, setMainTab] = useState<'actualite' | 'activites'>('actualite');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [biimFields, setBiimFields] = useState<BiimContactFormValues>(
    emptyBiimContactFormValues(),
  );
  const notesRef = useRef<HTMLDivElement>(null);
  const attachmentsRef = useRef<HTMLDivElement>(null);
  const contactsListRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/prospects/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Prospect introuvable');
      }
      const data = await res.json();
      setProspect(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setProspect(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadActivities = useCallback(async () => {
    if (!id) return;
    setActivitiesLoading(true);
    try {
      const res = await fetch(`/api/leads/${id}/activities`);
      if (!res.ok) {
        setActivities([]);
        return;
      }
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const sortedContacts = useMemo(() => {
    if (!prospect) return [];
    return [...prospect.contacts].sort((a, b) => {
      if (a.isMine === b.isMine) {
        return `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'fr',
        );
      }
      return a.isMine ? -1 : 1;
    });
  }, [prospect]);

  const filteredContacts = useMemo(() => {
    if (!contactQuery.trim()) return sortedContacts;
    const q = contactQuery.toLowerCase().trim();
    return sortedContacts.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(q))
      );
    });
  }, [sortedContacts, contactQuery]);

  const handleAddContact = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prospect) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setContactLoading(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: String(data.get('firstName') || ''),
          lastName: String(data.get('lastName') || ''),
          email: String(data.get('email') || '') || undefined,
          phone: String(data.get('phone') || '') || undefined,
          civility: String(data.get('civility') || '') || undefined,
          jobTitle: String(data.get('jobTitle') || '') || undefined,
          decisionRole: String(data.get('decisionRole') || 'NON_DETERMINE'),
          ...(isBiimUser
            ? {
                biimDocuments: biimFields.biimDocuments,
                biimRegistered: biimFields.biimRegistered || null,
                biimVisited: biimFields.biimVisited || null,
                biimApproved: biimFields.biimApproved || null,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Impossible d’ajouter le contact');
      }
      const created = await res.json().catch(() => ({}));
      if (isBiimUser && created?.id) {
        const uploads = getBiimDocumentUploads(biimFields);
        if (uploads.length > 0) {
          await uploadBiimContactDocuments(prospect.id, created.id, uploads);
        }
      }
      form.reset();
      setBiimFields(emptyBiimContactFormValues());
      setShowContactForm(false);
      await load();
      await loadActivities();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setContactLoading(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!prospect) return;
    if (!confirm('Supprimer ce contact ?')) return;
    const res = await fetch(
      `/api/prospects/${prospect.id}/contacts/${contactId}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      await load();
      await loadActivities();
    }
  };

  const socialLinks = useMemo(
    () => normalizeProspectSocialLinks(prospect?.socialLinks),
    [prospect?.socialLinks],
  );

  return (
    <DashboardShell
      title='Fiche entreprise'
      subtitle={prospect?.name ?? 'Prospect'}
    >
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <button
            type='button'
            onClick={() => router.push(backHref)}
            className='inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors'
          >
            <ArrowLeft className='w-3.5 h-3.5' /> {backLabel}
          </button>

          {prospect && !loading ? (
            <div className='relative'>
              <button
                type='button'
                onClick={() => setActionsOpen((v) => !v)}
                className='inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-neu-soft hover:text-primary'
              >
                Actions
                <MoreHorizontal className='h-3.5 w-3.5' />
              </button>
              {actionsOpen ? (
                <div className='absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-neu'>
                  <button
                    type='button'
                    className='flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-gray-700 hover:bg-gray-50'
                    onClick={() => {
                      setActionsOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className='h-3.5 w-3.5' />
                    Modifier
                  </button>
                  <button
                    type='button'
                    className='flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-gray-700 hover:bg-gray-50'
                    onClick={() => {
                      setActionsOpen(false);
                      setShowContactForm(true);
                      contactsListRef.current?.scrollIntoView({
                        behavior: 'smooth',
                      });
                    }}
                  >
                    <UserPlus className='h-3.5 w-3.5' />
                    Ajouter un contact
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading && (
          <div className='grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]'>
            <SkeletonLoader className='h-80 w-full rounded-2xl' />
            <SkeletonLoader className='h-80 w-full rounded-2xl' />
            <SkeletonLoader className='h-80 w-full rounded-2xl' />
          </div>
        )}

        {error && !loading && (
          <NeumoCard className='p-5 text-sm text-rose-600'>{error}</NeumoCard>
        )}

        {prospect && !loading && (
          <div className='grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:items-start'>
            {/* Colonne gauche */}
            <aside className='space-y-3 lg:sticky lg:top-4'>
              <NeumoCard className='bg-white p-4 space-y-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-primary/10 text-primary'>
                    {prospect.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prospect.logoUrl}
                        alt={`Logo ${prospect.name}`}
                        className='h-full w-full object-contain'
                      />
                    ) : (
                      <span className='text-sm font-semibold tracking-wide'>
                        {companyInitials(prospect.name)}
                      </span>
                    )}
                  </div>
                  <div className='min-w-0 flex-1 space-y-1 pt-0.5'>
                    <h1 className='text-lg font-semibold text-primary leading-snug'>
                      {prospect.name}
                    </h1>
                    {prospect.websiteUrl ? (
                      <a
                        href={ensureHttpUrl(prospect.websiteUrl)}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 text-[12px] text-primary hover:underline'
                      >
                        {displayWebsite(prospect.websiteUrl)}
                        <ExternalLink className='h-3 w-3' />
                      </a>
                    ) : (
                      <p className='text-[11px] text-gray-400'>Pas de site web</p>
                    )}
                  </div>
                </div>

                {prospect.websiteUrl || socialLinks.length > 0 ? (
                  <div className='flex flex-wrap items-center gap-2'>
                    {prospect.websiteUrl ? (
                      <LinkIconButton
                        label='Site web'
                        href={prospect.websiteUrl}
                        icon={Globe}
                      />
                    ) : null}
                    {socialLinks.map((link) => (
                      <LinkIconButton
                        key={`${link.network}-${link.url}`}
                        label={link.network}
                        href={link.url}
                        icon={socialNetworkIcon(link.network)}
                      />
                    ))}
                  </div>
                ) : null}
              </NeumoCard>

              <NeumoCard className='bg-white p-0 overflow-hidden'>
                <button
                  type='button'
                  onClick={() => setInfoOpen((v) => !v)}
                  className='flex w-full items-center justify-between px-4 py-3 text-left'
                >
                  <span className='text-sm font-semibold text-primary'>
                    Information
                  </span>
                  {infoOpen ? (
                    <ChevronUp className='h-4 w-4 text-gray-400' />
                  ) : (
                    <ChevronDown className='h-4 w-4 text-gray-400' />
                  )}
                </button>
                {infoOpen ? (
                  <dl className='px-4 pb-3'>
                    <InfoRow label="Propriétaire de l'entreprise">
                      {prospect.createdBy?.name ?? '—'}
                    </InfoRow>
                    <InfoRow label='Ville'>
                      {prospect.location?.trim() || '—'}
                    </InfoRow>
                    <InfoRow label='Type de client'>
                      <span className='inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px]'>
                        <Building2 className='h-3 w-3' />
                        {formatLeadTypeLabel(prospect.leadType)}
                      </span>
                    </InfoRow>
                    <InfoRow label="Secteur d'activité">
                      {prospect.activitySector?.trim() || '—'}
                    </InfoRow>
                    <InfoRow label='Source'>
                      {prospect.source?.trim() || '—'}
                    </InfoRow>
                    {prospect.geographicSituation ? (
                      <InfoRow label='Situation géographique'>
                        <a
                          href={prospect.geographicSituation}
                          target='_blank'
                          rel='noreferrer'
                          className='inline-flex items-center gap-1 text-primary hover:underline'
                        >
                          <MapPin className='h-3 w-3' />
                          Voir la carte
                        </a>
                      </InfoRow>
                    ) : null}
                    {prospect.activityDomains?.length > 0 ? (
                      <InfoRow label="Domaines d'activité">
                        <div className='flex flex-wrap gap-1'>
                          {prospect.activityDomains.map((domain) => (
                            <span
                              key={domain}
                              className='inline-flex max-w-full rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600'
                              title={domain}
                            >
                              <span className='truncate'>{domain}</span>
                            </span>
                          ))}
                        </div>
                      </InfoRow>
                    ) : null}
                  </dl>
                ) : null}
              </NeumoCard>
            </aside>

            {/* Colonne centre */}
            <section className='min-w-0 space-y-3 order-3 lg:order-2'>
              <NeumoCard className='bg-white p-4 space-y-4'>
                <div className='flex items-center gap-1 border-b border-gray-100'>
                  {(
                    [
                      { id: 'actualite' as const, label: 'Actualité' },
                      { id: 'activites' as const, label: 'Activités' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type='button'
                      onClick={() => setMainTab(tab.id)}
                      className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                        mainTab === tab.id
                          ? 'text-primary'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                      {mainTab === tab.id && (
                        <span className='absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary' />
                      )}
                    </button>
                  ))}
                </div>

                {mainTab === 'actualite' ? (
                  <div className='space-y-4'>
                    <div>
                      <h2 className='text-sm font-semibold text-primary mb-2'>
                        Vue d&apos;ensemble
                      </h2>
                      <div className='grid grid-cols-2 gap-2'>
                        <div className='rounded-xl border border-gray-100 bg-[#fafaff] px-3 py-2'>
                          <p className='text-[10px] text-gray-400'>Contacts</p>
                          <p className='text-sm font-semibold text-primary'>
                            {prospect.contacts.length}
                          </p>
                        </div>
                        <div className='rounded-xl border border-gray-100 bg-[#fafaff] px-3 py-2'>
                          <p className='text-[10px] text-gray-400'>Type</p>
                          <p className='text-sm font-semibold text-primary truncate'>
                            {formatLeadTypeLabel(prospect.leadType)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      ref={notesRef}
                      id='fiche-notes'
                      className='space-y-2 scroll-mt-4'
                    >
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4 text-primary' />
                        <h3 className='text-sm font-semibold text-primary'>
                          Informations sur l&apos;entreprise
                        </h3>
                      </div>
                      {prospect.notes ? (
                        <div className='rounded-2xl border border-gray-100 bg-[#fafaff] px-3.5 py-3'>
                          <p className='text-xs text-gray-700 whitespace-pre-wrap leading-relaxed'>
                            {prospect.notes}
                          </p>
                        </div>
                      ) : (
                        <p className='text-[11px] text-gray-400 rounded-2xl border border-dashed border-gray-200 px-3.5 py-6 text-center'>
                          Aucune note pour cette entreprise.
                        </p>
                      )}
                      {prospect.activityDomains?.length > 0 ? (
                        <div className='flex flex-wrap gap-1.5 pt-1'>
                          {prospect.activityDomains.map((domain) => (
                            <span
                              key={domain}
                              className='inline-flex items-center gap-1 rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] text-gray-600'
                            >
                              <Tag className='h-3 w-3 text-gray-400' />
                              {domain}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <h2 className='text-sm font-semibold text-primary'>
                      Activités
                    </h2>
                    {activitiesLoading ? (
                      <div className='space-y-2'>
                        <SkeletonLoader className='h-12 w-full' />
                        <SkeletonLoader className='h-12 w-full' />
                      </div>
                    ) : activities.length === 0 ? (
                      <p className='text-[11px] text-gray-400 rounded-2xl border border-dashed border-gray-200 px-3.5 py-8 text-center'>
                        Aucune activité enregistrée pour le moment.
                      </p>
                    ) : (
                      <ul className='space-y-2'>
                        {activities.map((activity) => (
                          <li
                            key={activity.id}
                            className='rounded-xl border border-gray-100 bg-[#fafaff] px-3 py-2.5'
                          >
                            <div className='flex items-start justify-between gap-2'>
                              <div className='min-w-0'>
                                <p className='text-[11px] font-semibold text-primary'>
                                  {activity.type}
                                </p>
                                {activity.content ? (
                                  <p className='mt-0.5 text-[11px] text-gray-600 whitespace-pre-wrap'>
                                    {activity.content}
                                  </p>
                                ) : null}
                                <p className='mt-1 text-[10px] text-gray-400'>
                                  {activity.user?.name ?? '—'}
                                </p>
                              </div>
                              <time className='shrink-0 text-[10px] text-gray-400'>
                                {new Date(activity.date).toLocaleString(
                                  'fr-FR',
                                  {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </NeumoCard>
            </section>

            {/* Colonne droite */}
            <aside className='space-y-3 order-2 xl:order-3 xl:sticky xl:top-4'>
              <NeumoCard
                id='fiche-contacts'
                className='bg-white p-4 space-y-3 scroll-mt-4'
              >
                <div ref={contactsListRef} />
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                      <Users className='h-4 w-4' />
                    </div>
                    <div className='min-w-0'>
                      <h2 className='text-sm font-semibold text-primary'>
                        Contacts
                      </h2>
                      <p className='text-[10px] text-gray-400'>
                        {prospect.contacts.length} contact
                        {prospect.contacts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowContactForm((v) => !v)}
                    className='inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-primary/90'
                  >
                    <Plus className='h-3 w-3' />
                    Ajouter
                  </button>
                </div>

                <div className='flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1.5'>
                  <Search className='h-3.5 w-3.5 text-gray-400 shrink-0' />
                  <input
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                    placeholder='Rechercher…'
                    className='min-w-0 flex-1 bg-transparent text-[11px] text-gray-700 outline-none'
                  />
                </div>

                {showContactForm && (
                  <form
                    onSubmit={handleAddContact}
                    className='rounded-2xl border border-primary/10 bg-[#fafaff] p-3 space-y-2.5'
                  >
                    <p className='text-[11px] font-medium text-primary flex items-center gap-1.5'>
                      <UserPlus className='w-3.5 h-3.5' />
                      Nouveau contact
                    </p>
                    <div className='grid grid-cols-1 gap-2'>
                      <Field name='firstName' label='Prénom' required />
                      <Field name='lastName' label='Nom' required />
                      <Field name='email' type='email' label='Email' />
                      <Field name='phone' label='Téléphone' />
                      <Field
                        name='civility'
                        label='Civilité'
                        list='contact-civility'
                      />
                      <Field name='jobTitle' label='Poste' />
                    </div>
                    <datalist id='contact-civility'>
                      {DEFAULT_CIVILITIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    <label className='flex flex-col gap-1 text-xs text-gray-700'>
                      <span className='text-[11px] text-gray-600'>
                        Rôle dans la décision
                      </span>
                      <select
                        name='decisionRole'
                        defaultValue='NON_DETERMINE'
                        className='h-9 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40'
                      >
                        {DECISION_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {isBiimUser ? (
                      <BiimContactFields
                        values={biimFields}
                        onChange={setBiimFields}
                      />
                    ) : null}
                    <div className='flex justify-end gap-2 pt-1'>
                      <button
                        type='button'
                        onClick={() => setShowContactForm(false)}
                        className='px-3 py-1.5 rounded-full text-[11px] bg-white border border-gray-200 text-gray-600'
                      >
                        Annuler
                      </button>
                      <button
                        type='submit'
                        disabled={contactLoading}
                        className='px-3 py-1.5 rounded-full text-[11px] font-medium bg-primary text-white disabled:opacity-60'
                      >
                        {contactLoading ? '…' : 'Enregistrer'}
                      </button>
                    </div>
                  </form>
                )}

                <div className='max-h-[420px] space-y-2 overflow-y-auto pr-0.5'>
                  {filteredContacts.map((contact) => {
                    const stage = contact.negotiationStage ?? 'EN_PROSPECTION';
                    const fullName =
                      `${contact.civility ? `${contact.civility} ` : ''}${contact.firstName} ${contact.lastName}`.trim();
                    return (
                      <div
                        key={contact.id}
                        className='rounded-xl border border-gray-100 bg-[#fafaff] p-3 space-y-1.5'
                      >
                        <div className='flex items-start gap-2.5'>
                          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white'>
                            {contactInitials(contact)}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-start justify-between gap-1'>
                              <p className='text-[12px] font-semibold text-primary truncate'>
                                {fullName}
                              </p>
                              {contact.canEdit ? (
                                <button
                                  type='button'
                                  onClick={() => void deleteContact(contact.id)}
                                  className='shrink-0 text-rose-400 hover:text-rose-600'
                                  title='Supprimer'
                                  aria-label='Supprimer le contact'
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </button>
                              ) : null}
                            </div>
                            <p className='text-[10px] text-gray-500 truncate'>
                              {[contact.jobTitle, `chez ${prospect.name}`]
                                .filter(Boolean)
                                .join(' ')}
                            </p>
                            <div className='mt-1 flex flex-wrap gap-1'>
                              <span className='rounded-full bg-gray-50 border border-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600'>
                                {formatDecisionRoleLabel(contact.decisionRole)}
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                  NEGOTIATION_STAGE_STYLES[
                                    stage as keyof typeof NEGOTIATION_STAGE_STYLES
                                  ] ?? 'bg-gray-50 text-gray-600'
                                }`}
                                title={NEGOTIATION_STAGE_FIELD_LABEL}
                              >
                                {formatNegotiationStageLabel(stage)}
                              </span>
                            </div>
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className='mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline truncate'
                              >
                                <Mail className='h-3 w-3 shrink-0' />
                                <span className='truncate'>{contact.email}</span>
                              </a>
                            ) : null}
                            {contact.phone ? (
                              <a
                                href={`tel:${contact.phone}`}
                                className='flex items-center gap-1 text-[11px] text-gray-600 hover:text-primary'
                              >
                                <Phone className='h-3 w-3 shrink-0' />
                                {contact.phone}
                              </a>
                            ) : null}
                            {(normalizeBiimDocuments(contact.biimDocuments)
                              .length > 0 ||
                              contact.biimRegistered != null ||
                              contact.biimVisited != null ||
                              contact.biimApproved != null) && (
                              <div className='flex flex-wrap gap-1 pt-1'>
                                {normalizeBiimDocuments(
                                  contact.biimDocuments,
                                ).map((doc) => (
                                  <span
                                    key={doc}
                                    className='rounded-full border border-gray-100 bg-white px-1.5 py-0.5 text-[9px] text-gray-600'
                                  >
                                    {doc}
                                  </span>
                                ))}
                                {contact.biimRegistered != null ? (
                                  <span className='rounded-full border border-gray-100 bg-white px-1.5 py-0.5 text-[9px] text-gray-600'>
                                    BIIM :{' '}
                                    {formatBiimYesNo(contact.biimRegistered)}
                                  </span>
                                ) : null}
                                {contact.biimVisited != null ? (
                                  <span className='rounded-full border border-gray-100 bg-white px-1.5 py-0.5 text-[9px] text-gray-600'>
                                    Visitée :{' '}
                                    {formatBiimYesNo(contact.biimVisited)}
                                  </span>
                                ) : null}
                                {contact.biimApproved != null ? (
                                  <span className='rounded-full border border-gray-100 bg-white px-1.5 py-0.5 text-[9px] text-gray-600'>
                                    Approuvé :{' '}
                                    {formatBiimYesNo(contact.biimApproved)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {contact.canViewFiche !== false ? (
                              <Link
                                href={`/leads/${prospect.id}/contacts/${contact.id}`}
                                className='mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline'
                              >
                                Fiche contact
                                <ExternalLink className='h-3 w-3' />
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredContacts.length === 0 && !showContactForm ? (
                    <div className='rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center space-y-2'>
                      <p className='text-[11px] text-gray-500'>
                        {contactQuery
                          ? 'Aucun contact ne correspond.'
                          : 'Aucun contact visible pour votre profil.'}
                      </p>
                      {!contactQuery ? (
                        <button
                          type='button'
                          onClick={() => setShowContactForm(true)}
                          className='inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[10px] font-medium text-white'
                        >
                          <Plus className='h-3 w-3' />
                          Ajouter
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {prospect.contacts.length > 0 ? (
                  <button
                    type='button'
                    onClick={() =>
                      contactsListRef.current?.scrollIntoView({
                        behavior: 'smooth',
                      })
                    }
                    className='inline-flex w-full items-center justify-center gap-1 text-[11px] font-medium text-primary hover:underline'
                  >
                    Afficher tous les contacts
                    <ExternalLink className='h-3 w-3' />
                  </button>
                ) : null}
              </NeumoCard>

              <div
                ref={attachmentsRef}
                id='fiche-attachments'
                className='scroll-mt-4'
              >
                <LeadAttachmentsBlock leadId={prospect.id} />
              </div>
            </aside>
          </div>
        )}
      </div>

      <ProspectEditSheet
        open={editOpen}
        prospect={prospect}
        onClose={() => setEditOpen(false)}
        onUpdated={(updated) => {
          setProspect((prev) =>
            prev
              ? {
                  ...prev,
                  name: updated.name,
                  leadType: updated.leadType,
                  activitySector: updated.activitySector,
                  activityDomains: updated.activityDomains ?? [],
                  location: updated.location,
                  geographicSituation: updated.geographicSituation,
                  websiteUrl: updated.websiteUrl,
                  logoUrl: updated.logoUrl,
                  socialLinks: updated.socialLinks ?? [],
                  source: updated.source,
                  notes: updated.notes,
                }
              : prev,
          );
        }}
      />
    </DashboardShell>
  );
}
