'use client';

import NeumoCard from './NeumoCard';
import {
  Building2,
  CalendarDays,
  Copy,
  FileText,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  TrendingUp,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import type { ClientForSheet } from './ClientEditSheet';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

interface ClientViewSheetProps {
  open: boolean;
  client: ClientForSheet | null;
  onClose: () => void;
  onEdit?: (client: ClientForSheet) => void;
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'CL';
}

function formatMoney(amount: number) {
  return amount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  });
}

function formatConvertedAt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className='flex items-start justify-between gap-3 text-[11px]'>
      <span className='shrink-0 text-gray-500'>{label}</span>
      <div className='min-w-0 text-right text-gray-800 font-medium'>
        {children}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  accent = false,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border px-3.5 py-3 space-y-2.5 ${
        accent
          ? 'border-primary/20 bg-primary/[0.04] shadow-neu-soft'
          : 'border-gray-100 bg-white'
      }`}
    >
      <div className='flex items-center gap-2'>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-xl ${
            accent ? 'bg-primary/15' : 'bg-gray-50'
          }`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${accent ? 'text-primary' : 'text-gray-500'}`}
          />
        </div>
        <h3 className='text-[10px] font-semibold uppercase tracking-wide text-primary'>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export default function ClientViewSheet({
  open,
  client,
  onClose,
  onEdit,
}: ClientViewSheetProps) {
  const [interests, setInterests] = useState<
    { kind: 'product' | 'service'; name: string; estimatedValue: number }[]
  >([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [errorInterests, setErrorInterests] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !client) return;

    const loadInterests = async () => {
      setLoadingInterests(true);
      setErrorInterests(null);
      try {
        const res = await fetch(`/api/clients/${client.id}/interests`);
        if (!res.ok) {
          if (res.status === 404) {
            setInterests([]);
            return;
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || 'Impossible de récupérer les intérêts du client',
          );
        }
        const data = (await res.json()) as {
          products: {
            kind: 'product';
            name: string;
            estimatedValue: number;
          }[];
          services: {
            kind: 'service';
            name: string;
            estimatedValue: number;
          }[];
        };
        setInterests([...data.products, ...data.services]);
      } catch (err: unknown) {
        setErrorInterests(
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des intérêts',
        );
      } finally {
        setLoadingInterests(false);
      }
    };

    loadInterests();
  }, [open, client]);

  if (!open || !client) return null;

  const products = interests.filter((i) => i.kind === 'product');
  const services = interests.filter((i) => i.kind === 'service');

  const totalProducts = products.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.estimatedValue) ? item.estimatedValue : 0),
    0,
  );
  const totalServices = services.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.estimatedValue) ? item.estimatedValue : 0),
    0,
  );

  const totalEstimated = totalProducts + totalServices;
  const COMMISSION_RATE = 0.03;
  const estimatedCommission = totalEstimated * COMMISSION_RATE;
  const realizedCommission = client.totalRevenue * COMMISSION_RATE;

  const companyLabel =
    client.companyName?.trim() || client.company?.name?.trim() || null;
  const phone = client.phone?.trim() || null;
  const email = client.email?.trim() || null;

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // silencieux
    }
  };

  return (
    <div
      className='fixed inset-0 z-40 flex justify-end bg-black/25 backdrop-blur-[2px]'
      role='dialog'
      aria-modal='true'
      aria-labelledby='client-view-title'
    >
      <button
        type='button'
        className='absolute inset-0 cursor-default'
        aria-label='Fermer le panneau'
        onClick={onClose}
      />
      <div className='relative h-full w-full max-w-md p-3 sm:p-4'>
        <NeumoCard className='flex h-full max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] flex-col overflow-hidden bg-[#f7f7fc] p-0 shadow-neu'>
          {/* Header sticky */}
          <div className='shrink-0 border-b border-white/70 bg-white/80 px-4 pb-3.5 pt-4 backdrop-blur-sm'>
            <div className='mb-3 flex items-start justify-between gap-2'>
              <p
                id='client-view-title'
                className='text-[10px] font-semibold uppercase tracking-wide text-gray-400'
              >
                Détails du client
              </p>
              <button
                type='button'
                onClick={onClose}
                className='flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700'
                aria-label='Fermer'
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </div>

            <div className='flex items-start gap-3'>
              <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-neu-soft'>
                {initialsFrom(client.name)}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <h2 className='truncate text-base font-semibold text-primary'>
                    {client.name}
                  </h2>
                  <span className='inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700'>
                    Client
                  </span>
                  {client.civility ? (
                    <span className='rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600'>
                      {client.civility}
                    </span>
                  ) : null}
                </div>
                {companyLabel ? (
                  <p className='mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500'>
                    <Building2 className='h-3 w-3 shrink-0' />
                    {companyLabel}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Actions rapides */}
            <div className='mt-3 flex flex-wrap gap-1.5'>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className='inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-1.5 text-[10px] font-medium text-gray-700 shadow-neu-soft transition-colors hover:border-primary/20 hover:text-primary'
                >
                  <Phone className='h-3 w-3' />
                  Appeler
                </a>
              ) : null}
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className='inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-1.5 text-[10px] font-medium text-gray-700 shadow-neu-soft transition-colors hover:border-primary/20 hover:text-primary'
                >
                  <Mail className='h-3 w-3' />
                  Email
                </a>
              ) : null}
              {onEdit ? (
                <button
                  type='button'
                  onClick={() => onEdit(client)}
                  className='inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10'
                >
                  <Pencil className='h-3 w-3' />
                  Modifier
                </button>
              ) : null}
            </div>
          </div>

          {/* Contenu scrollable */}
          <div className='flex-1 space-y-3 overflow-y-auto px-4 py-4'>
            {/* CA mis en avant */}
            <section className='rounded-2xl border border-primary/15 bg-white px-3.5 py-3 shadow-neu-soft'>
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <div className='flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10'>
                    <TrendingUp className='h-3.5 w-3.5 text-primary' />
                  </div>
                  <span className='text-[10px] font-semibold uppercase tracking-wide text-primary'>
                    Chiffres clés
                  </span>
                </div>
              </div>
              <div className='mt-2.5 grid grid-cols-2 gap-2'>
                <div className='rounded-xl bg-[#f5f5ff] px-3 py-2.5'>
                  <p className='text-[9px] font-medium uppercase tracking-wide text-gray-400'>
                    CA réalisé
                  </p>
                  <p className='mt-0.5 text-[13px] font-semibold tabular-nums text-primary'>
                    {formatMoney(client.totalRevenue)}
                  </p>
                </div>
                <div className='rounded-xl bg-primary/5 px-3 py-2.5'>
                  <p className='text-[9px] font-medium uppercase tracking-wide text-gray-400'>
                    Commission 3 %
                  </p>
                  <p className='mt-0.5 text-[13px] font-semibold tabular-nums text-primary'>
                    {formatMoney(realizedCommission)}
                  </p>
                </div>
              </div>
            </section>

            <SectionCard icon={Mail} title='Contact'>
              <div className='space-y-2'>
                {email ? (
                  <div className='flex items-center justify-between gap-2 rounded-xl bg-gray-50/80 px-2.5 py-2'>
                    <div className='min-w-0'>
                      <p className='text-[9px] uppercase tracking-wide text-gray-400'>
                        Email
                      </p>
                      <a
                        href={`mailto:${email}`}
                        className='block truncate text-[11px] font-medium text-primary hover:underline'
                      >
                        {email}
                      </a>
                    </div>
                    <button
                      type='button'
                      onClick={() => copyValue('email', email)}
                      className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-primary'
                      title='Copier'
                      aria-label='Copier l’email'
                    >
                      <Copy className='h-3 w-3' />
                    </button>
                  </div>
                ) : null}
                {phone ? (
                  <div className='flex items-center justify-between gap-2 rounded-xl bg-gray-50/80 px-2.5 py-2'>
                    <div className='min-w-0'>
                      <p className='text-[9px] uppercase tracking-wide text-gray-400'>
                        Téléphone
                      </p>
                      <a
                        href={`tel:${phone}`}
                        className='block truncate text-[11px] font-medium text-gray-800 hover:underline'
                      >
                        {phone}
                      </a>
                    </div>
                    <button
                      type='button'
                      onClick={() => copyValue('phone', phone)}
                      className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-primary'
                      title='Copier'
                      aria-label='Copier le téléphone'
                    >
                      <Copy className='h-3 w-3' />
                    </button>
                  </div>
                ) : null}
                {!email && !phone && client.contact ? (
                  <DetailRow label='Contact'>{client.contact}</DetailRow>
                ) : null}
                {!email && !phone && !client.contact ? (
                  <p className='text-[11px] text-gray-400'>
                    Aucune coordonnée renseignée.
                  </p>
                ) : null}
                {copied ? (
                  <p className='text-[10px] text-emerald-600'>
                    {copied === 'email' ? 'Email' : 'Téléphone'} copié
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard icon={Building2} title='Contexte commercial'>
              <div className='space-y-2'>
                <DetailRow label='Société'>
                  {companyLabel ?? '—'}
                </DetailRow>
                {client.source ? (
                  <DetailRow label='Source'>
                    <span className='inline-flex rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px]'>
                      {client.source}
                    </span>
                  </DetailRow>
                ) : null}
                {client.activityDomain ? (
                  <DetailRow label='Secteur'>{client.activityDomain}</DetailRow>
                ) : null}
                {client.location ? (
                  <div className='flex items-center gap-1.5 pt-0.5 text-[11px] text-gray-700'>
                    <MapPin className='h-3 w-3 shrink-0 text-gray-400' />
                    <span>{client.location}</span>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard icon={UserRound} title='Conversion'>
              <div className='space-y-2'>
                <DetailRow label='Converti par'>
                  {client.convertedBy?.name ?? 'Non renseigné'}
                </DetailRow>
                {client.convertedAt ? (
                  <div className='flex items-center justify-between gap-2 text-[11px]'>
                    <span className='inline-flex items-center gap-1 text-gray-500'>
                      <CalendarDays className='h-3 w-3' />
                      Date
                    </span>
                    <span className='font-medium text-gray-800'>
                      {formatConvertedAt(client.convertedAt)}
                    </span>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard icon={Package} title='Produits & services' accent>
              {loadingInterests && (
                <p className='text-[11px] text-gray-400'>Chargement…</p>
              )}
              {errorInterests && (
                <p className='text-[11px] text-rose-500'>{errorInterests}</p>
              )}
              {!loadingInterests &&
                !errorInterests &&
                interests.length === 0 && (
                  <p className='text-[11px] text-gray-500'>
                    Aucun produit ou service enregistré.
                  </p>
                )}
              {interests.length > 0 && (
                <div className='space-y-3 text-[11px]'>
                  {products.length > 0 && (
                    <div className='space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <span className='inline-flex items-center gap-1 font-semibold text-gray-700'>
                          <Package className='h-3 w-3 text-gray-400' />
                          Produits ({products.length})
                        </span>
                        <span className='font-semibold tabular-nums text-gray-800'>
                          {formatMoney(totalProducts)}
                        </span>
                      </div>
                      <ul className='space-y-1 rounded-xl border border-gray-100 bg-white/80 px-2.5 py-2'>
                        {products.map((item, index) => (
                          <li
                            key={`product-${index}`}
                            className='flex items-center justify-between gap-2'
                          >
                            <span className='min-w-0 truncate font-medium text-gray-800'>
                              {item.name}
                            </span>
                            <span className='shrink-0 tabular-nums text-gray-700'>
                              {formatMoney(item.estimatedValue)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {services.length > 0 && (
                    <div className='space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <span className='inline-flex items-center gap-1 font-semibold text-gray-700'>
                          <Wrench className='h-3 w-3 text-gray-400' />
                          Services ({services.length})
                        </span>
                        <span className='font-semibold tabular-nums text-gray-800'>
                          {formatMoney(totalServices)}
                        </span>
                      </div>
                      <ul className='space-y-1 rounded-xl border border-gray-100 bg-white/80 px-2.5 py-2'>
                        {services.map((item, index) => (
                          <li
                            key={`service-${index}`}
                            className='flex items-center justify-between gap-2'
                          >
                            <span className='min-w-0 truncate font-medium text-gray-800'>
                              {item.name}
                            </span>
                            <span className='shrink-0 tabular-nums text-gray-700'>
                              {formatMoney(item.estimatedValue)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className='space-y-1 border-t border-dashed border-gray-200 pt-2'>
                    <DetailRow label='Pipeline estimé'>
                      {formatMoney(totalEstimated)}
                    </DetailRow>
                    <DetailRow label='Commission estimée (3 %)'>
                      <span className='text-primary'>
                        {formatMoney(estimatedCommission)}
                      </span>
                    </DetailRow>
                  </div>
                </div>
              )}
            </SectionCard>

            {client.notes ? (
              <SectionCard icon={FileText} title='Notes'>
                <p className='whitespace-pre-wrap text-[11px] leading-relaxed text-gray-700'>
                  {client.notes}
                </p>
              </SectionCard>
            ) : null}
          </div>
        </NeumoCard>
      </div>
    </div>
  );
}
