'use client';

import { useEffect, useState, type FormEvent } from 'react';
import NeumoCard from './NeumoCard';
import { Field } from './ui/field';
import ActivityDomainsChecklist from './ActivityDomainsChecklist';
import InteractionHistory from './InteractionHistory';
import type { Lead } from './LeadCard';
import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
  DEFAULT_LEAD_SOURCES,
  DECISION_ROLE_OPTIONS,
  LEAD_TYPE_OPTIONS,
} from '@/config/lead-options';
import {
  NEGOTIATION_STAGE_FIELD_LABEL,
  NEGOTIATION_STAGE_OPTIONS,
  mapLegacyLeadStatusToNegotiationStage,
} from '@/config/negotiation-stage';

interface LeadEditSheetProps {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onUpdated?: (lead: Lead) => void;
  onDeleted?: (id: string) => void;
  /**
   * `contact` : uniquement les infos du contact (fiche prospection).
   * `full` : contact + entreprise (liste / legacy).
   */
  mode?: 'full' | 'contact';
}

export default function LeadEditSheet({
  open,
  lead,
  onClose,
  onUpdated,
  onDeleted,
  mode = 'full',
}: LeadEditSheetProps) {
  const contactOnly = mode === 'contact';

  const [status, setStatus] = useState<string>(
    mapLegacyLeadStatusToNegotiationStage(lead?.status),
  );
  const [leadType, setLeadType] = useState<string>(
    lead?.leadType ?? 'NON_DETERMINE',
  );
  const [decisionRole, setDecisionRole] = useState<string>(
    lead?.decisionRole ?? 'NON_DETERMINE',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [productsTouched, setProductsTouched] = useState(false);
  const [servicesTouched, setServicesTouched] = useState(false);
  const [selectedActivityDomains, setSelectedActivityDomains] = useState<
    string[]
  >(lead?.activityDomains ?? []);
  const [activitySector, setActivitySector] = useState(
    lead?.activitySector ?? '',
  );

  useEffect(() => {
    if (!open || !lead) return;
    setStatus(mapLegacyLeadStatusToNegotiationStage(lead.status));
    setLeadType(lead.leadType ?? 'NON_DETERMINE');
    setDecisionRole(lead.decisionRole ?? 'NON_DETERMINE');
    setSelectedActivityDomains(lead.activityDomains ?? []);
    setActivitySector(lead.activitySector ?? '');
    setError(null);

    if (contactOnly) return;

    const fetchInterests = async () => {
      try {
        const [prodRes, servRes, leadRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/services'),
          fetch(`/api/leads/${lead.id}`),
        ]);
        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducts(data);
        }
        if (servRes.ok) {
          const data = await servRes.json();
          setServices(data);
        }
        if (leadRes.ok) {
          const full = await leadRes.json();
          setSelectedProductIds(
            Array.isArray(full.products)
              ? full.products.map((p: { id: string }) => p.id)
              : [],
          );
          setSelectedServiceIds(
            Array.isArray(full.services)
              ? full.services.map((s: { id: string }) => s.id)
              : [],
          );
        }
      } catch {
        // silencieux
      } finally {
        setProductsTouched(false);
        setServicesTouched(false);
      }
    };

    void fetchInterests();
  }, [open, lead?.id, contactOnly]);

  if (!open || !lead) return null;

  const toggleProduct = (id: string) => {
    setProductsTouched(true);
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleService = (id: string) => {
    setServicesTouched(true);
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const firstName = String(data.get('firstName') || '');
    const lastName = String(data.get('lastName') || '');
    const email = String(data.get('email') || '');
    const phone = String(data.get('phone') || '');
    const source = String(data.get('source') || '');
    const companyName = String(data.get('companyName') || '');
    const jobTitle = String(data.get('jobTitle') || '');
    const location = String(data.get('location') || '');
    const geographicSituation = String(data.get('geographicSituation') || '');
    const civility = String(data.get('civility') || '');
    const notes = String(data.get('notes') || '');

    setLoading(true);
    setError(null);

    try {
      const prospectId = lead.prospectId;
      const contactId =
        lead.contactId || (lead.prospectId ? lead.id : undefined);

      if (prospectId && contactId) {
        const contactRes = await fetch(
          `/api/prospects/${prospectId}/contacts/${contactId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName,
              lastName,
              email: email || null,
              phone: phone || null,
              civility: civility || null,
              jobTitle: jobTitle || null,
              notes: notes || null,
              decisionRole,
              negotiationStage: status,
            }),
          },
        );
        if (!contactRes.ok) {
          const body = await contactRes.json().catch(() => ({}));
          throw new Error(
            body.error || 'Impossible de mettre à jour le contact',
          );
        }

        if (!contactOnly) {
          const prospectRes = await fetch(`/api/prospects/${prospectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: companyName || undefined,
              source: source || null,
              location: location || null,
              geographicSituation: geographicSituation || null,
              activitySector: activitySector || null,
              activityDomains: selectedActivityDomains,
              leadType,
              status,
              notes: notes || null,
            }),
          });
          if (!prospectRes.ok) {
            const body = await prospectRes.json().catch(() => ({}));
            throw new Error(
              body.error || 'Impossible de mettre à jour l’entreprise',
            );
          }
        }

        const updatedContact = await contactRes.json();
        onUpdated?.({
          ...lead,
          ...updatedContact,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          civility: civility || null,
          jobTitle: jobTitle || null,
          notes: notes || null,
          decisionRole,
          status,
          ...(contactOnly
            ? {}
            : {
                companyName: companyName || lead.companyName,
                leadType,
                activitySector: activitySector || null,
                activityDomains: selectedActivityDomains,
                source: source || null,
                location: location || null,
              }),
          prospectId,
          contactId,
        });
        onClose();
        return;
      }

      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          source: source || undefined,
          companyName: companyName || undefined,
          jobTitle: jobTitle || undefined,
          location: location || undefined,
          activitySector: activitySector || undefined,
          activityDomains: selectedActivityDomains,
          civility: civility || undefined,
          notes: notes || undefined,
          leadType,
          status,
          productIds: productsTouched ? selectedProductIds : undefined,
          serviceIds: servicesTouched ? selectedServiceIds : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Impossible de mettre à jour le lead');
      }

      const updated = (await res.json()) as Lead;
      onUpdated?.(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (contactOnly && lead.prospectId && (lead.contactId || lead.id)) {
      if (!confirm('Supprimer ce contact ?')) return;
      setLoading(true);
      setError(null);
      try {
        const contactId = lead.contactId || lead.id;
        const res = await fetch(
          `/api/prospects/${lead.prospectId}/contacts/${contactId}`,
          { method: 'DELETE' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Impossible de supprimer le contact');
        }
        onDeleted?.(contactId);
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (
      !confirm(
        'Mettre ce prospect à la corbeille ? Il pourra être restauré par un responsable.',
      )
    )
      return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads?id=${encodeURIComponent(lead.id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Impossible de supprimer le lead');
      }

      onDeleted?.(lead.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm'>
      <div
        className='h-full w-full max-w-md bg-transparent p-4'
        onClick={onClose}
      >
        <div
          className='h-full'
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <NeumoCard className='h-full bg-white p-5 flex flex-col gap-4 shadow-neu-soft overflow-y-auto'>
            <div className='flex items-center justify-between shrink-0'>
              <div>
                <h2 className='text-sm font-semibold text-primary'>
                  {contactOnly ? 'Modifier le contact' : 'Détails du lead'}
                </h2>
                <p className='text-[11px] text-gray-500'>
                  {contactOnly
                    ? 'Civilité, coordonnées, poste et rôle — sans les infos entreprise.'
                    : 'Consultez et mettez à jour les informations du prospect.'}
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

            <form
              key={`${lead.id}-${mode}-${open}`}
              onSubmit={handleSubmit}
              className='flex flex-col gap-3 text-xs text-gray-700 shrink-0'
            >
              <Field
                name='civility'
                label='Civilité'
                defaultValue={lead.civility ?? ''}
                list='lead-civility-options'
              />
              <datalist id='lead-civility-options'>
                {DEFAULT_CIVILITIES.map((civ) => (
                  <option key={civ} value={civ} />
                ))}
              </datalist>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                <Field
                  name='firstName'
                  label='Prénom'
                  defaultValue={lead.firstName}
                  required
                />
                <Field
                  name='lastName'
                  label='Nom'
                  defaultValue={lead.lastName}
                  required
                />
              </div>
              <Field
                name='email'
                type='email'
                label='Email'
                defaultValue={lead.email ?? ''}
              />
              <Field
                name='phone'
                label='Téléphone'
                defaultValue={lead.phone ?? ''}
              />
              <Field
                name='jobTitle'
                label='Poste / Fonction'
                placeholder='Ex: Directeur commercial'
                defaultValue={lead.jobTitle ?? ''}
              />

              <label className='flex flex-col gap-1 text-xs text-gray-700'>
                <span className='text-[11px] text-gray-600'>
                  Rôle dans la décision
                </span>
                <select
                  value={decisionRole}
                  onChange={(e) => setDecisionRole(e.target.value)}
                  className='h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40'
                >
                  {DECISION_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {!contactOnly && (
                <>
                  <Field
                    name='companyName'
                    label='Nom de la compagnie'
                    defaultValue={lead.companyName ?? ''}
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
                  <Field
                    name='location'
                    label='Quartier, Commune, Ville, Pays'
                    defaultValue={lead.location ?? ''}
                    placeholder='Angré 7e tranche, Cocody, Abidjan, Côte d’Ivoire'
                  />
                  <Field
                    name='geographicSituation'
                    label='Situation géographique'
                    type='url'
                    defaultValue={lead.geographicSituation ?? ''}
                    placeholder='https://maps.app.goo.gl/…'
                    description='Lien Google Maps de l’entreprise.'
                  />
                  <Field
                    name='source'
                    label='Source'
                    defaultValue={lead.source ?? ''}
                    description="Canal d'acquisition du lead."
                    list='lead-source-options'
                  />
                  <datalist id='lead-source-options'>
                    {DEFAULT_LEAD_SOURCES.map((src) => (
                      <option key={src} value={src} />
                    ))}
                  </datalist>
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
                      {DEFAULT_ACTIVITY_SECTORS.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ActivityDomainsChecklist
                    selected={selectedActivityDomains}
                    onChange={setSelectedActivityDomains}
                    activitySector={activitySector}
                  />
                </>
              )}

              <Field
                name='notes'
                label='Notes'
                defaultValue={lead.notes ?? ''}
                description={
                  contactOnly
                    ? 'Notes liées à ce contact.'
                    : 'Observations générales sur le lead.'
                }
              />

              {!contactOnly && (products.length > 0 || services.length > 0) && (
                <div className='mt-2 flex flex-col gap-2'>
                  <span className='text-[11px] text-gray-500'>
                    Intérêt pour des produits / services
                  </span>
                  <div className='grid grid-cols-1 gap-2'>
                    {products.length > 0 && (
                      <div className='flex flex-col gap-1 rounded-2xl bg-gray-50 border border-gray-100 p-2'>
                        <span className='text-[11px] font-medium text-gray-600'>
                          Produits
                        </span>
                        <div className='max-h-24 overflow-y-auto pr-1 flex flex-col gap-1'>
                          {products.map((p) => (
                            <label
                              key={p.id}
                              className='inline-flex items-center gap-2 text-[11px] text-gray-700'
                            >
                              <input
                                type='checkbox'
                                className='h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary/40'
                                checked={selectedProductIds.includes(p.id)}
                                onChange={() => toggleProduct(p.id)}
                              />
                              <span className='truncate'>{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {services.length > 0 && (
                      <div className='flex flex-col gap-1 rounded-2xl bg-gray-50 border border-gray-100 p-2'>
                        <span className='text-[11px] font-medium text-gray-600'>
                          Services
                        </span>
                        <div className='max-h-24 overflow-y-auto pr-1 flex flex-col gap-1'>
                          {services.map((s) => (
                            <label
                              key={s.id}
                              className='inline-flex items-center gap-2 text-[11px] text-gray-700'
                            >
                              <input
                                type='checkbox'
                                className='h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary/40'
                                checked={selectedServiceIds.includes(s.id)}
                                onChange={() => toggleService(s.id)}
                              />
                              <span className='truncate'>{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className='flex flex-col gap-1 mt-1'>
                <span className='text-[11px] text-gray-500'>
                  {NEGOTIATION_STAGE_FIELD_LABEL}
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className='h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40'
                >
                  {NEGOTIATION_STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className='text-[11px] text-rose-500 mt-1'>{error}</p>
              )}

              <div className='mt-4 flex justify-between items-center gap-2'>
                <button
                  type='button'
                  onClick={handleDelete}
                  className='px-3 py-1.5 rounded-full text-[11px] bg-rose-50 text-rose-600'
                >
                  {contactOnly ? 'Supprimer' : 'Mettre à la corbeille'}
                </button>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={onClose}
                    className='px-3 py-1.5 rounded-full text-[11px] bg-gray-100 text-gray-600'
                  >
                    Fermer
                  </button>
                  <button
                    type='submit'
                    disabled={loading}
                    className='px-4 py-1.5 rounded-full text-[11px] bg-primary text-white shadow-neu disabled:opacity-60'
                  >
                    {loading ? 'En cours...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>

            {!contactOnly && (
              <div className='shrink-0 border-t border-gray-100 pt-4 mt-2'>
                <InteractionHistory lead={lead} />
              </div>
            )}
          </NeumoCard>
        </div>
      </div>
    </div>
  );
}
