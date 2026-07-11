'use client';

import GroupCompanySelect from '@/components/GroupCompanySelect';
import NeumoCard from '@/components/NeumoCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import {
  TRASH_ENTITY_LABELS,
  TRASH_ENTITY_TYPES,
  type TrashEntityType,
  type TrashItemDto,
} from '@/lib/trash-types';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

type TrashListResponse = {
  items: TrashItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PendingAction = {
  type: 'restore' | 'purge';
  item: TrashItemDto;
};

const ENTITY_BADGE_CLASS: Record<TrashEntityType, string> = {
  LEAD: 'bg-sky-100 text-sky-800 border-sky-200',
  USER: 'bg-violet-100 text-violet-800 border-violet-200',
  GOAL: 'bg-amber-100 text-amber-800 border-amber-200',
  ATTACHMENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function TrashConfirmDialog({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pending) return null;

  const isPurge = pending.type === 'purge';
  const title = isPurge
    ? 'Supprimer définitivement ?'
    : 'Restaurer cet élément ?';
  const description = isPurge
    ? `« ${pending.item.label} » sera supprimé de façon irréversible. Cette action ne peut pas être annulée.`
    : `« ${pending.item.label} » sera réintégré dans le CRM.`;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      role='dialog'
      aria-modal='true'
      aria-labelledby='trash-confirm-title'
    >
      <div className='w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-gray-100'>
        <h3
          id='trash-confirm-title'
          className={`text-sm font-semibold ${isPurge ? 'text-red-700' : 'text-primary'}`}
        >
          {title}
        </h3>
        <p className='mt-2 text-xs text-gray-600 leading-relaxed'>{description}</p>
        <div className='mt-5 flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onCancel}
            disabled={busy}
          >
            Annuler
          </Button>
          <Button
            type='button'
            size='sm'
            variant={isPurge ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy
              ? 'Traitement…'
              : isPurge
                ? 'Supprimer définitivement'
                : 'Restaurer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TrashBinPanel() {
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    apiCompanyId,
  } = useGroupCompanyScope();

  const [data, setData] = useState<TrashListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<TrashEntityType | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      if (entityType) params.set('entityType', entityType);
      if (search.trim()) params.set('q', search.trim());
      if (apiCompanyId) params.set('companyId', apiCompanyId);

      const res = await fetch(`/api/trash?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setData(null);
        setError(
          typeof json?.error === 'string'
            ? json.error
            : 'Impossible de charger la corbeille.',
        );
        return;
      }
      setData(json as TrashListResponse);
    } catch {
      setData(null);
      setError('Impossible de charger la corbeille.');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, search, apiCompanyId]);

  useEffect(() => {
    void fetchTrash();
  }, [fetchTrash]);

  useEffect(() => {
    setPage(1);
  }, [entityType, search, apiCompanyId]);

  const runAction = async () => {
    if (!pending) return;
    setActionBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const companyQuery = apiCompanyId
        ? `?companyId=${encodeURIComponent(apiCompanyId)}`
        : '';
      const url =
        pending.type === 'restore'
          ? `/api/trash/restore${companyQuery}`
          : `/api/trash${companyQuery}`;
      const res = await fetch(url, {
        method: pending.type === 'restore' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: pending.item.entityType,
          id: pending.item.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof json?.error === 'string'
            ? json.error
            : 'Action impossible.',
        );
        return;
      }
      setSuccess(
        pending.type === 'restore'
          ? `« ${pending.item.label} » a été restauré.`
          : `« ${pending.item.label} » a été supprimé définitivement.`,
      );
      setPending(null);
      await fetchTrash();
    } catch {
      setError('Action impossible.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      <div>
        <h1 className='text-lg font-semibold text-primary flex items-center gap-2'>
          <Trash2 className='w-5 h-5' />
          Corbeille
        </h1>
        <p className='text-xs text-gray-500 mt-1'>
          Éléments supprimés récupérables. Restaurez-les ou supprimez-les
          définitivement.
        </p>
      </div>

      <NeumoCard className='bg-white p-4 shadow-neu-soft flex flex-col gap-4'>
        <div className='flex flex-col lg:flex-row lg:flex-wrap gap-3 lg:items-end'>
          {hasGroupScope && (
            <GroupCompanySelect
              id='trash-company'
              label='Entreprise'
              value={selectedCompanyId}
              options={companyOptions}
              onChange={setSelectedCompanyId}
              includeHoldingOption
            />
          )}
          <div className='flex flex-col gap-1 min-w-[160px]'>
            <label
              htmlFor='trash-type'
              className='text-[11px] text-gray-500'
            >
              Type
            </label>
            <select
              id='trash-type'
              value={entityType}
              onChange={(e) =>
                setEntityType(e.target.value as TrashEntityType | '')
              }
              className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs w-full sm:w-auto min-w-[160px]'
            >
              <option value=''>Tous les types</option>
              {TRASH_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TRASH_ENTITY_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <form
            className='flex flex-1 min-w-[200px] gap-2 items-end'
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
          >
            <div className='flex flex-col gap-1 flex-1'>
              <label
                htmlFor='trash-search'
                className='text-[11px] text-gray-500'
              >
                Recherche
              </label>
              <input
                id='trash-search'
                type='search'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder='Nom, e-mail, fichier…'
                className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs w-full'
              />
            </div>
            <Button type='submit' size='sm' variant='outline' className='shrink-0'>
              <Search className='w-3.5 h-3.5' />
            </Button>
          </form>
        </div>

        {success && (
          <p className='text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2'>
            {success}
          </p>
        )}
        {error && (
          <p className='text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2'>
            {error}
          </p>
        )}

        {loading && (
          <p className='text-xs text-gray-500'>Chargement de la corbeille…</p>
        )}

        {!loading && !error && data && data.items.length === 0 && (
          <Empty className='border border-dashed border-gray-200 py-10'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Trash2 className='text-gray-400' />
              </EmptyMedia>
              <EmptyTitle>La corbeille est vide</EmptyTitle>
              <EmptyDescription>
                Les prospects, utilisateurs, objectifs et pièces jointes mis à la
                corbeille apparaîtront ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className='overflow-x-auto'>
              <table className='min-w-full text-xs'>
                <thead className='text-gray-500 border-b border-gray-100'>
                  <tr>
                    <th className='py-2 text-left font-medium'>Type</th>
                    <th className='py-2 text-left font-medium'>Nom</th>
                    {hasGroupScope && (
                      <th className='py-2 text-left font-medium'>Société</th>
                    )}
                    <th className='py-2 text-left font-medium'>Supprimé le</th>
                    <th className='py-2 text-left font-medium'>Par</th>
                    <th className='py-2 text-right font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {data.items.map((item) => (
                    <tr key={`${item.entityType}-${item.id}`}>
                      <td className='py-2.5 pr-2'>
                        <Badge
                          variant='outline'
                          className={ENTITY_BADGE_CLASS[item.entityType]}
                        >
                          {TRASH_ENTITY_LABELS[item.entityType]}
                        </Badge>
                      </td>
                      <td className='py-2.5 pr-2 font-medium text-gray-800'>
                        {item.label}
                      </td>
                      {hasGroupScope && (
                        <td className='py-2.5 pr-2 text-gray-600'>
                          {item.companyName ?? '—'}
                        </td>
                      )}
                      <td className='py-2.5 pr-2 text-gray-600 whitespace-nowrap'>
                        {formatDateTime(item.deletedAt)}
                      </td>
                      <td className='py-2.5 pr-2 text-gray-600'>
                        {item.deletedBy?.name ?? '—'}
                      </td>
                      <td className='py-2.5 text-right whitespace-nowrap'>
                        <div className='flex justify-end gap-1.5'>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            className='h-7 text-[11px] gap-1'
                            onClick={() =>
                              setPending({ type: 'restore', item })
                            }
                          >
                            <RotateCcw className='w-3 h-3' />
                            Restaurer
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='destructive'
                            className='h-7 text-[11px]'
                            onClick={() =>
                              setPending({ type: 'purge', item })
                            }
                          >
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className='flex items-center justify-between pt-2 border-t border-gray-100'>
                <p className='text-[11px] text-gray-500'>
                  {data.total} élément{data.total > 1 ? 's' : ''} — page{' '}
                  {data.page} / {data.totalPages}
                </p>
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={data.page >= data.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(data.totalPages, p + 1))
                    }
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </NeumoCard>

      <TrashConfirmDialog
        pending={pending}
        busy={actionBusy}
        onCancel={() => !actionBusy && setPending(null)}
        onConfirm={() => void runAction()}
      />
    </div>
  );
}
