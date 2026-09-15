'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ActivityDomainsChecklist from './ActivityDomainsChecklist';
import NeumoCard from './NeumoCard';
import ProspectSocialLinksFields from './ProspectSocialLinksFields';
import { Field } from './ui/field';
import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_LEAD_SOURCES,
  LEAD_TYPE_OPTIONS,
} from '@/config/lead-options';
import {
  normalizeProspectSocialLinks,
  type ProspectSocialLink,
} from '@/config/prospect-socials';

export type ProspectEditData = {
  id: string;
  name: string;
  leadType: string;
  activitySector?: string | null;
  activityDomains?: string[];
  location?: string | null;
  geographicSituation?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  socialLinks?: ProspectSocialLink[];
  source?: string | null;
  notes?: string | null;
};

interface ProspectEditSheetProps {
  open: boolean;
  prospect: ProspectEditData | null;
  onClose: () => void;
  onUpdated?: (prospect: ProspectEditData) => void;
}

export default function ProspectEditSheet({
  open,
  prospect,
  onClose,
  onUpdated,
}: ProspectEditSheetProps) {
  const [leadType, setLeadType] = useState('NON_DETERMINE');
  const [activitySector, setActivitySector] = useState('');
  const [selectedActivityDomains, setSelectedActivityDomains] = useState<
    string[]
  >([]);
  const [socialLinks, setSocialLinks] = useState<ProspectSocialLink[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !prospect) return;
    setLeadType(prospect.leadType || 'NON_DETERMINE');
    setActivitySector(prospect.activitySector ?? '');
    setSelectedActivityDomains(prospect.activityDomains ?? []);
    setSocialLinks(normalizeProspectSocialLinks(prospect.socialLinks));
    setLogoFile(null);
    setLogoPreview(prospect.logoUrl ?? null);
    setRemoveLogo(false);
    setError(null);
  }, [open, prospect]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  if (!open || !prospect) return null;

  const handleLogoChange = (file: File | null) => {
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(
      file ? URL.createObjectURL(file) : (prospect.logoUrl ?? null),
    );
  };

  const handleRemoveLogo = () => {
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        leadType,
        activitySector: activitySector || null,
        activityDomains: selectedActivityDomains,
        location: String(data.get('location') || '').trim() || null,
        geographicSituation:
          String(data.get('geographicSituation') || '').trim() || null,
        websiteUrl: String(data.get('websiteUrl') || '').trim() || null,
        socialLinks: normalizeProspectSocialLinks(socialLinks),
        source: String(data.get('source') || '').trim() || null,
        notes: String(data.get('notes') || '').trim() || null,
      };

      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : "Impossible de modifier l'entreprise.",
        );
      }

      let nextLogoUrl =
        body.logoUrl !== undefined ? body.logoUrl : prospect.logoUrl;
      if (removeLogo) {
        const del = await fetch(`/api/prospects/${prospect.id}/logo`, {
          method: 'DELETE',
        });
        if (del.ok) nextLogoUrl = null;
      } else if (logoFile) {
        const logoData = new FormData();
        logoData.append('logo', logoFile);
        const logoRes = await fetch(`/api/prospects/${prospect.id}/logo`, {
          method: 'POST',
          body: logoData,
        });
        const logoBody = await logoRes.json().catch(() => ({}));
        if (logoRes.ok) nextLogoUrl = logoBody.logoUrl ?? nextLogoUrl;
      }

      onUpdated?.({
        id: prospect.id,
        name: body.name ?? name,
        leadType: body.leadType ?? leadType,
        activitySector:
          body.activitySector !== undefined
            ? body.activitySector
            : payload.activitySector,
        activityDomains: Array.isArray(body.activityDomains)
          ? body.activityDomains
          : selectedActivityDomains,
        location:
          body.location !== undefined ? body.location : payload.location,
        geographicSituation:
          body.geographicSituation !== undefined
            ? body.geographicSituation
            : payload.geographicSituation,
        websiteUrl:
          body.websiteUrl !== undefined
            ? body.websiteUrl
            : payload.websiteUrl,
        logoUrl: nextLogoUrl,
        socialLinks: Array.isArray(body.socialLinks)
          ? body.socialLinks
          : payload.socialLinks,
        source: body.source !== undefined ? body.source : payload.source,
        notes: body.notes !== undefined ? body.notes : payload.notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm'>
      <div className='h-full w-full max-w-md bg-transparent p-4' onClick={onClose}>
        <div
          className='h-full'
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <NeumoCard className='flex h-full max-h-[90vh] flex-col gap-4 overflow-hidden bg-white p-5 shadow-neu-soft'>
            <div className='flex shrink-0 items-center justify-between'>
              <div>
                <h2 className='text-sm font-semibold text-primary'>
                  Modifier l&apos;entreprise
                </h2>
                <p className='text-[11px] text-gray-500'>
                  Informations partagées du prospect entreprise.
                </p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='text-[11px] text-gray-400 hover:text-gray-600'
              >
                Fermer
              </button>
            </div>

            <form
              key={`${prospect.id}-${open}`}
              onSubmit={handleSubmit}
              className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 text-xs text-gray-700'
            >
              <Field
                name='name'
                label="Nom de l'entreprise"
                defaultValue={prospect.name}
                required
              />

              <div className='flex flex-col gap-1'>
                <span className='text-[11px] text-gray-500'>Type de client</span>
                <select
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                  className='h-8 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
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
                  className='h-8 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
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
                defaultValue={prospect.location ?? ''}
              />
              <Field
                name='geographicSituation'
                label='Situation géographique'
                type='url'
                placeholder='https://maps.app.goo.gl/…'
                defaultValue={prospect.geographicSituation ?? ''}
              />
              <Field
                name='websiteUrl'
                label='Site web'
                type='url'
                placeholder='https://www.exemple.ci'
                defaultValue={prospect.websiteUrl ?? ''}
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
                        alt='Logo entreprise'
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
                    {logoPreview || logoFile ? (
                      <button
                        type='button'
                        onClick={handleRemoveLogo}
                        className='self-start text-[10px] text-rose-500 hover:underline'
                      >
                        Supprimer le logo
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
                list='prospect-edit-source-options'
                defaultValue={prospect.source ?? ''}
              />
              <datalist id='prospect-edit-source-options'>
                {DEFAULT_LEAD_SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <Field
                name='notes'
                label='Notes'
                defaultValue={prospect.notes ?? ''}
              />

              {error && (
                <p className='mt-1 text-[11px] text-rose-500'>{error}</p>
              )}

              <div className='mt-2 flex shrink-0 justify-end gap-2'>
                <button
                  type='button'
                  onClick={onClose}
                  className='rounded-full bg-gray-100 px-3 py-1.5 text-[11px] text-gray-600'
                >
                  Annuler
                </button>
                <button
                  type='submit'
                  disabled={loading}
                  className='rounded-full bg-primary px-4 py-1.5 text-[11px] text-white shadow-neu disabled:opacity-60'
                >
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </NeumoCard>
        </div>
      </div>
    </div>
  );
}
