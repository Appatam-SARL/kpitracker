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
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

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

export default function ProspectDetailPage() {
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
  const [biimFields, setBiimFields] = useState<BiimContactFormValues>(
    emptyBiimContactFormValues(),
  );

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

  useEffect(() => {
    void load();
  }, [load]);

  const sortedContacts = useMemo(() => {
    if (!prospect) return [];
    return [...prospect.contacts].sort((a, b) => {
      if (a.isMine === b.isMine) return 0;
      return a.isMine ? -1 : 1;
    });
  }, [prospect]);

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
    if (res.ok) await load();
  };

  return (
    <DashboardShell
      title='Fiche entreprise'
      subtitle={prospect?.name ?? 'Prospect'}
    >
      <div className='space-y-4'>
        <button
          type='button'
          onClick={() => router.push('/leads')}
          className='inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors'
        >
          <ArrowLeft className='w-3.5 h-3.5' /> Retour aux prospects
        </button>

        {loading && (
          <NeumoCard className='p-5 space-y-4'>
            <div className='flex gap-3'>
              <SkeletonLoader className='h-12 w-12 rounded-2xl shrink-0' />
              <div className='flex-1 space-y-2'>
                <SkeletonLoader className='h-6 w-48' />
                <SkeletonLoader className='h-4 w-72' />
              </div>
            </div>
            <SkeletonLoader className='h-20 w-full rounded-xl' />
          </NeumoCard>
        )}

        {error && !loading && (
          <NeumoCard className='p-5 text-sm text-rose-600'>{error}</NeumoCard>
        )}

        {prospect && !loading && (
          <>
            <NeumoCard className='p-5 md:p-6 space-y-4'>
              <div className='flex flex-col sm:flex-row sm:items-start gap-4'>
                <div className='flex items-start gap-3 min-w-0 flex-1'>
                  <div className='w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/10 overflow-hidden'>
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
                  <div className='min-w-0 space-y-1.5'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h1 className='text-xl font-semibold text-primary truncate'>
                        {prospect.name}
                      </h1>
                      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-100 text-[10px] text-gray-600'>
                        <Building2 className='w-3 h-3' />
                        {formatLeadTypeLabel(prospect.leadType)}
                      </span>
                    </div>
                    <div className='flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500'>
                      {prospect.activitySector && (
                        <span className='inline-flex items-center gap-1'>
                          <Tag className='w-3 h-3 text-gray-400' />
                          {prospect.activitySector}
                        </span>
                      )}
                      {prospect.location && (
                        <span className='inline-flex items-center gap-1'>
                          <MapPin className='w-3 h-3 text-gray-400' />
                          {prospect.location}
                        </span>
                      )}
                      {prospect.geographicSituation && (
                        <a
                          href={prospect.geographicSituation}
                          target='_blank'
                          rel='noreferrer'
                          className='inline-flex items-center gap-1 text-primary hover:underline'
                        >
                          <ExternalLink className='w-3 h-3' />
                          Situation géographique
                        </a>
                      )}
                      {prospect.websiteUrl && (
                        <a
                          href={prospect.websiteUrl}
                          target='_blank'
                          rel='noreferrer'
                          className='inline-flex items-center gap-1 text-primary hover:underline'
                        >
                          <Globe className='w-3 h-3' />
                          Site web
                        </a>
                      )}
                      {prospect.source && (
                        <span className='text-gray-400'>
                          Source : {prospect.source}
                        </span>
                      )}
                    </div>
                    {normalizeProspectSocialLinks(prospect.socialLinks).length >
                      0 && (
                      <div className='flex flex-wrap gap-1.5 pt-0.5'>
                        {normalizeProspectSocialLinks(prospect.socialLinks).map(
                          (link) => (
                            <a
                              key={`${link.network}-${link.url}`}
                              href={link.url}
                              target='_blank'
                              rel='noreferrer'
                              className='inline-flex items-center rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] font-medium text-primary hover:border-primary/30'
                            >
                              {link.network}
                            </a>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type='button'
                  onClick={() => setEditOpen(true)}
                  className='inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors shrink-0 self-start'
                >
                  <Pencil className='w-3.5 h-3.5' />
                  Modifier
                </button>
              </div>

              {prospect.activityDomains?.length > 0 && (
                <div className='space-y-1.5'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Domaines d&apos;activité
                  </p>
                  <div className='flex flex-wrap gap-1.5'>
                    {prospect.activityDomains.map((domain) => (
                      <span
                        key={domain}
                        className='inline-flex max-w-full px-2.5 py-1 rounded-full bg-white border border-gray-100 text-[10px] text-gray-600'
                        title={domain}
                      >
                        <span className='truncate'>{domain}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {prospect.notes ? (
                <div className='rounded-2xl bg-white/80 border border-gray-100 px-3.5 py-3 space-y-1'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Notes
                  </p>
                  <p className='text-xs text-gray-700 whitespace-pre-wrap leading-relaxed'>
                    {prospect.notes}
                  </p>
                </div>
              ) : null}
            </NeumoCard>

            <NeumoCard className='p-5 md:p-6 space-y-4'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center'>
                    <Users className='w-4 h-4' />
                  </div>
                  <div>
                    <h2 className='text-sm font-semibold text-primary'>
                      Contacts
                    </h2>
                    <p className='text-[10px] text-gray-400'>
                      {prospect.contacts.length === 0
                        ? 'Aucun contact pour l’instant'
                        : `${prospect.contacts.length} contact${
                            prospect.contacts.length > 1 ? 's' : ''
                          }`}
                    </p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setShowContactForm((v) => !v)}
                  className='inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors'
                >
                  <Plus className='w-3.5 h-3.5' />
                  {showContactForm ? 'Fermer le formulaire' : 'Ajouter mon contact'}
                </button>
              </div>

              {showContactForm && (
                <form
                  onSubmit={handleAddContact}
                  className='rounded-2xl border border-primary/10 bg-white/70 p-4 space-y-3'
                >
                  <p className='text-[11px] font-medium text-primary flex items-center gap-1.5'>
                    <UserPlus className='w-3.5 h-3.5' />
                    Nouveau contact
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
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
                      className='px-3.5 py-2 rounded-full text-[11px] bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    >
                      Annuler
                    </button>
                    <button
                      type='submit'
                      disabled={contactLoading}
                      className='px-3.5 py-2 rounded-full text-[11px] font-medium bg-primary text-white disabled:opacity-60'
                    >
                      {contactLoading ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              )}

              <div className='space-y-2.5'>
                {sortedContacts.map((contact) => {
                  const roleLabel = formatDecisionRoleLabel(contact.decisionRole);
                  const stage = contact.negotiationStage ?? 'EN_PROSPECTION';
                  const stageLabel = formatNegotiationStageLabel(stage);
                  return (
                    <div
                      key={contact.id}
                      className='rounded-2xl border border-gray-100 bg-white/80 p-3.5 hover:border-primary/15 transition-colors'
                    >
                      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
                        <div className='flex items-start gap-3 min-w-0 flex-1'>
                          <div className='w-10 h-10 rounded-full bg-linear-to-br from-primary/80 to-indigo-500 flex items-center justify-center text-white text-[11px] font-semibold shrink-0 shadow-sm'>
                            {contactInitials(contact)}
                          </div>
                          <div className='min-w-0 space-y-1.5'>
                            <div className='flex flex-wrap items-center gap-1.5'>
                              <p className='text-sm font-medium text-primary truncate'>
                                {contact.civility ? `${contact.civility} ` : ''}
                                {contact.firstName} {contact.lastName}
                              </p>
                              {contact.isMine && (
                                <span className='px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-medium'>
                                  Vous
                                </span>
                              )}
                              <span className='px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100 text-[9px]'>
                                {roleLabel}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                  NEGOTIATION_STAGE_STYLES[
                                    stage as keyof typeof NEGOTIATION_STAGE_STYLES
                                  ] ??
                                  'bg-gray-50 text-gray-600 border border-gray-100'
                                }`}
                                title={NEGOTIATION_STAGE_FIELD_LABEL}
                              >
                                {stageLabel}
                              </span>
                            </div>
                            {contact.jobTitle && (
                              <p className='text-[11px] text-gray-500 truncate'>
                                {contact.jobTitle}
                              </p>
                            )}
                            {(normalizeBiimDocuments(contact.biimDocuments)
                              .length > 0 ||
                              contact.biimRegistered != null ||
                              contact.biimVisited != null ||
                              contact.biimApproved != null) && (
                              <div className='flex flex-wrap gap-1.5'>
                                {normalizeBiimDocuments(
                                  contact.biimDocuments,
                                ).map((doc) => (
                                  <span
                                    key={doc}
                                    className='rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[9px] text-gray-600'
                                  >
                                    {doc}
                                  </span>
                                ))}
                                {contact.biimRegistered != null ? (
                                  <span className='rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[9px] text-gray-600'>
                                    BIIM : {formatBiimYesNo(contact.biimRegistered)}
                                  </span>
                                ) : null}
                                {contact.biimVisited != null ? (
                                  <span className='rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[9px] text-gray-600'>
                                    Visitée : {formatBiimYesNo(contact.biimVisited)}
                                  </span>
                                ) : null}
                                {contact.biimApproved != null ? (
                                  <span className='rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[9px] text-gray-600'>
                                    Approuvé : {formatBiimYesNo(contact.biimApproved)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            <div className='flex flex-wrap gap-x-3 gap-y-1 text-[11px]'>
                              {contact.email ? (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className='inline-flex items-center gap-1 text-gray-600 hover:text-primary truncate max-w-full'
                                >
                                  <Mail className='w-3 h-3 shrink-0' />
                                  <span className='truncate'>{contact.email}</span>
                                </a>
                              ) : null}
                              {contact.phone ? (
                                <a
                                  href={`tel:${contact.phone}`}
                                  className='inline-flex items-center gap-1 text-gray-600 hover:text-primary'
                                >
                                  <Phone className='w-3 h-3 shrink-0' />
                                  {contact.phone}
                                </a>
                              ) : null}
                            </div>
                            <p className='text-[10px] text-gray-400'>
                              Ajouté par {contact.createdBy?.name ?? '—'}
                            </p>
                          </div>
                        </div>

                        <div className='flex items-center gap-2 sm:shrink-0 sm:self-center pl-13 sm:pl-0'>
                          {contact.canViewFiche !== false && (
                            <Link
                              href={`/leads/${prospect.id}/contacts/${contact.id}`}
                              className='inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-medium bg-primary text-white hover:bg-primary/90 transition-colors'
                            >
                              <ExternalLink className='w-3.5 h-3.5' />
                              Fiche prospection
                            </Link>
                          )}
                          {contact.canEdit && (
                            <button
                              type='button'
                              onClick={() => void deleteContact(contact.id)}
                              className='inline-flex items-center justify-center w-9 h-9 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors'
                              title='Supprimer'
                              aria-label='Supprimer le contact'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {prospect.contacts.length === 0 && !showContactForm && (
                  <div className='rounded-2xl border border-dashed border-gray-200 bg-white/50 px-4 py-8 text-center space-y-3'>
                    <div className='mx-auto w-10 h-10 rounded-full bg-primary/5 text-primary/70 flex items-center justify-center'>
                      <UserPlus className='w-5 h-5' />
                    </div>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium text-primary'>
                        Ajoutez votre premier contact
                      </p>
                      <p className='text-[11px] text-gray-500 max-w-sm mx-auto'>
                        Chaque commercial gère ses propres contacts sur cette
                        entreprise partagée.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => setShowContactForm(true)}
                      className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-[11px] font-medium'
                    >
                      <Plus className='w-3.5 h-3.5' />
                      Ajouter mon contact
                    </button>
                  </div>
                )}
              </div>
            </NeumoCard>

            <LeadAttachmentsBlock leadId={prospect.id} />
          </>
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
