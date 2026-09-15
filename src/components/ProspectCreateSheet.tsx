'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ActivityDomainsChecklist from './ActivityDomainsChecklist';
import BiimContactFields, {
  emptyBiimContactFormValues,
  getBiimDocumentUploads,
  type BiimContactFormValues,
} from './BiimContactFields';
import NeumoCard from './NeumoCard';
import ProspectSocialLinksFields from './ProspectSocialLinksFields';
import { Field } from './ui/field';
import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
  DEFAULT_LEAD_SOURCES,
  DECISION_ROLE_OPTIONS,
  LEAD_TYPE_OPTIONS,
} from '@/config/lead-options';
import { isBiimCompanyName } from '@/config/biim-contact-fields';
import {
  normalizeProspectSocialLinks,
  type ProspectSocialLink,
} from '@/config/prospect-socials';
import { useAuth } from '@/contexts/AuthContext';
import { uploadBiimContactDocuments } from '@/lib/upload-biim-documents';
import { useRouter } from 'next/navigation';

interface ProspectCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (prospect: { id: string; name: string }) => void;
}

type SearchItem = {
  id: string;
  name: string;
  leadType: string;
  activitySector?: string | null;
  status: string;
  contactsCount: number;
};

export default function ProspectCreateSheet({
  open,
  onClose,
  onCreated,
}: ProspectCreateSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isBiimUser = isBiimCompanyName(user?.company?.name);
  const [step, setStep] = useState<'search' | 'create'>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [exactMatch, setExactMatch] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [leadType, setLeadType] = useState('NON_DETERMINE');
  const [decisionRole, setDecisionRole] = useState('NON_DETERMINE');
  const [activitySector, setActivitySector] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivityDomains, setSelectedActivityDomains] = useState<
    string[]
  >([]);
  const [socialLinks, setSocialLinks] = useState<ProspectSocialLink[]>([]);
  const [biimFields, setBiimFields] = useState<BiimContactFormValues>(
    emptyBiimContactFormValues(),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('search');
    setQuery('');
    setResults([]);
    setExactMatch(null);
    setError(null);
    setLeadType('NON_DETERMINE');
    setDecisionRole('NON_DETERMINE');
    setActivitySector('');
    setSelectedActivityDomains([]);
    setSocialLinks([]);
    setBiimFields(emptyBiimContactFormValues());
    setLogoFile(null);
    setLogoPreview(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    if (!open || step !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setExactMatch(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/prospects/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.items ?? []);
        setExactMatch(data.exactMatch ?? null);
      } catch {
        // silencieux
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, open, step]);

  if (!open) return null;

  const openExisting = (id: string) => {
    onClose();
    router.push(`/leads/${id}`);
  };

  const handleLogoChange = (file: File | null) => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') || ''),
          leadType,
          activitySector: activitySector || undefined,
          activityDomains:
            selectedActivityDomains.length > 0
              ? selectedActivityDomains
              : undefined,
          location: String(data.get('location') || '') || undefined,
          geographicSituation:
            String(data.get('geographicSituation') || '') || undefined,
          websiteUrl: String(data.get('websiteUrl') || '') || undefined,
          socialLinks: normalizeProspectSocialLinks(socialLinks),
          source: String(data.get('source') || '') || undefined,
          notes: String(data.get('notes') || '') || undefined,
          contact: {
            firstName: String(data.get('firstName') || ''),
            lastName: String(data.get('lastName') || ''),
            email: String(data.get('email') || '') || undefined,
            phone: String(data.get('phone') || '') || undefined,
            civility: String(data.get('civility') || '') || undefined,
            jobTitle: String(data.get('jobTitle') || '') || undefined,
            decisionRole,
            ...(isBiimUser
              ? {
                  biimDocuments: biimFields.biimDocuments,
                  biimRegistered: biimFields.biimRegistered || null,
                  biimVisited: biimFields.biimVisited || null,
                  biimApproved: biimFields.biimApproved || null,
                }
              : {}),
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.existingId) {
          setError(
            `${body.error} Ouvrez « ${body.existingName} » pour y ajouter un contact.`,
          );
          return;
        }
        throw new Error(body.error || 'Impossible de créer le prospect');
      }

      const firstContactId = Array.isArray(body.contacts)
        ? body.contacts[0]?.id
        : null;
      if (logoFile && body.id) {
        const logoData = new FormData();
        logoData.append('logo', logoFile);
        await fetch(`/api/prospects/${body.id}/logo`, {
          method: 'POST',
          body: logoData,
        });
      }
      if (isBiimUser && body.id && firstContactId) {
        const uploads = getBiimDocumentUploads(biimFields);
        if (uploads.length > 0) {
          await uploadBiimContactDocuments(body.id, firstContactId, uploads);
        }
      }

      onCreated?.({ id: body.id, name: body.name });
      onClose();
      router.push(`/leads/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm'>
      <div className='h-full w-full max-w-md bg-transparent p-4' onClick={onClose}>
        <div className='h-full' onClick={(e) => e.stopPropagation()}>
          <NeumoCard className='h-full max-h-[90vh] bg-white p-5 flex flex-col gap-4 shadow-neu-soft overflow-hidden'>
            <div className='flex items-center justify-between shrink-0'>
              <div>
                <h2 className='text-sm font-semibold text-primary'>
                  {step === 'search'
                    ? 'Rechercher une entreprise'
                    : 'Nouvelle entreprise prospectée'}
                </h2>
                <p className='text-[11px] text-gray-500'>
                  {step === 'search'
                    ? 'Vérifiez d’abord si le prospect existe déjà (pool GROUP).'
                    : 'Créez l’entreprise puis votre premier contact.'}
                </p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs'
              >
                ✕
              </button>
            </div>

            {step === 'search' ? (
              <div className='flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto'>
                <Field
                  name='search'
                  label="Nom de l'entreprise"
                  placeholder='Ex: Acme Corp'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <p className='text-[11px] text-gray-400'>Recherche…</p>
                )}
                {exactMatch && (
                  <div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>
                    Correspondance exacte : <strong>{exactMatch.name}</strong>
                    <button
                      type='button'
                      className='ml-2 text-primary underline'
                      onClick={() => openExisting(exactMatch.id)}
                    >
                      Ouvrir
                    </button>
                  </div>
                )}
                <ul className='space-y-2'>
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        type='button'
                        onClick={() => openExisting(item.id)}
                        className='w-full text-left rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 hover:border-primary/40'
                      >
                        <div className='text-xs font-medium text-primary'>
                          {item.name}
                        </div>
                        <div className='text-[10px] text-gray-500'>
                          {item.contactsCount} contact
                          {item.contactsCount > 1 ? 's' : ''}
                          {item.activitySector
                            ? ` · ${item.activitySector}`
                            : ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {query.trim().length >= 2 &&
                  !searching &&
                  results.length === 0 && (
                    <p className='text-[11px] text-gray-500'>
                      Aucune entreprise trouvée.
                    </p>
                  )}
                <div className='mt-auto flex justify-end gap-2 pt-2'>
                  <button
                    type='button'
                    onClick={onClose}
                    className='px-3 py-1.5 rounded-full text-[11px] bg-gray-100 text-gray-600'
                  >
                    Annuler
                  </button>
                  <button
                    type='button'
                    disabled={query.trim().length < 2 || Boolean(exactMatch)}
                    onClick={() => setStep('create')}
                    className='px-4 py-1.5 rounded-full text-[11px] bg-primary text-white shadow-neu disabled:opacity-60'
                  >
                    Créer « {query.trim() || '…'} »
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleCreate}
                className='flex-1 min-h-0 flex flex-col gap-3 text-xs text-gray-700 overflow-y-auto pr-1'
              >
                <Field
                  name='name'
                  label="Nom de l'entreprise"
                  defaultValue={query.trim()}
                  required
                />
                <div className='flex flex-col gap-1'>
                  <span className='text-[11px] text-gray-500'>
                    Type de client
                  </span>
                  <select
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value)}
                    className='h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40'
                  >
                    {LEAD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className='flex flex-col gap-1 text-xs text-gray-700'>
                  <span className='text-[11px] text-gray-600'>
                    Secteur d&apos;activités
                  </span>
                  <select
                    value={activitySector}
                    onChange={(e) => {
                      setActivitySector(e.target.value);
                      setSelectedActivityDomains([]);
                    }}
                    className='h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40'
                  >
                    <option value=''>Sélectionner un secteur…</option>
                    {DEFAULT_ACTIVITY_SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <ActivityDomainsChecklist
                  selected={selectedActivityDomains}
                  onChange={setSelectedActivityDomains}
                  activitySector={activitySector}
                />
                <Field
                  name='location'
                  label='Quartier, Commune, Ville, Pays'
                  placeholder='Angré 7e tranche, Cocody, Abidjan, Côte d’Ivoire'
                />
                <Field
                  name='geographicSituation'
                  label='Situation géographique'
                  type='url'
                  placeholder='https://maps.app.goo.gl/…'
                />
                <Field
                  name='websiteUrl'
                  label='Site web'
                  type='url'
                  placeholder='https://www.exemple.ci'
                />
                <div className='flex flex-col gap-2'>
                  <span className='text-[11px] text-gray-600'>
                    Logo de l&apos;entreprise
                  </span>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50'>
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt='Aperçu logo'
                          className='h-full w-full object-contain'
                        />
                      ) : (
                        <span className='text-[10px] text-gray-400'>Logo</span>
                      )}
                    </div>
                    <div className='flex min-w-0 flex-1 flex-col gap-1'>
                      <input
                        type='file'
                        accept='image/png,image/jpeg,image/webp,image/gif,image/svg+xml'
                        onChange={(e) =>
                          handleLogoChange(e.target.files?.[0] ?? null)
                        }
                        className='block w-full text-[11px] text-gray-600 file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[10px] file:font-medium file:text-white'
                      />
                      {logoFile ? (
                        <button
                          type='button'
                          onClick={() => handleLogoChange(null)}
                          className='self-start text-[10px] text-rose-500 hover:underline'
                        >
                          Retirer
                        </button>
                      ) : (
                        <p className='text-[10px] text-gray-400'>
                          JPG, PNG, WEBP · max 2 Mo
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <ProspectSocialLinksFields
                  value={socialLinks}
                  onChange={setSocialLinks}
                />
                <Field
                  name='source'
                  label='Source'
                  list='prospect-source-options'
                />
                <datalist id='prospect-source-options'>
                  {DEFAULT_LEAD_SOURCES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <Field name='notes' label='Notes' />

                <p className='pt-2 text-[11px] font-medium text-primary'>
                  Votre contact chez cette entreprise
                </p>
                <div className='grid grid-cols-2 gap-2'>
                  <Field name='firstName' label='Prénom' required />
                  <Field name='lastName' label='Nom' required />
                </div>
                <Field name='email' type='email' label='Email' />
                <Field name='phone' label='Téléphone' />
                <Field
                  name='civility'
                  label='Civilité'
                  list='prospect-civility-options'
                />
                <datalist id='prospect-civility-options'>
                  {DEFAULT_CIVILITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <Field name='jobTitle' label='Poste / Fonction' />
                <label className='flex flex-col gap-1 text-xs text-gray-700'>
                  <span className='text-[11px] text-gray-600'>
                    Rôle dans la décision
                  </span>
                  <select
                    value={decisionRole}
                    onChange={(e) => setDecisionRole(e.target.value)}
                    className='h-8 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
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

                {error && (
                  <p className='mt-1 text-[11px] text-rose-500'>{error}</p>
                )}

                <div className='mt-4 flex justify-between gap-2'>
                  <button
                    type='button'
                    onClick={() => setStep('search')}
                    className='rounded-full bg-gray-100 px-3 py-1.5 text-[11px] text-gray-600'
                  >
                    Retour
                  </button>
                  <button
                    type='submit'
                    disabled={loading}
                    className='rounded-full bg-primary px-4 py-1.5 text-[11px] text-white shadow-neu disabled:opacity-60'
                  >
                    {loading ? 'En cours…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </NeumoCard>
        </div>
      </div>
    </div>
  );
}
