'use client';

import NeumoCard from '@/components/NeumoCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Filter, History, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ActionLogItem = {
  id: string;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type ActionHistoryResponse = {
  items: ActionLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type FiltersState = {
  from: string;
  to: string;
  actions: string[];
  entities: string[];
  q: string;
};

const EMPTY_FILTERS: FiltersState = {
  from: '',
  to: '',
  actions: [],
  entities: [],
  q: '',
};

const ACTION_FILTER_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'AUTH_LOGIN', label: 'Connexion' },
  { code: 'AUTH_LOGOUT', label: 'Déconnexion' },
  { code: 'AUTH_PASSWORD_CHANGE', label: 'Changement de mot de passe' },
  { code: 'AUTH_PASSWORD_RESET', label: 'Réinitialisation du mot de passe' },
  { code: 'USER_CREATE', label: 'Création utilisateur' },
  { code: 'USER_UPDATE', label: 'Mise à jour utilisateur' },
  { code: 'USER_PASSWORD_SET', label: 'Mot de passe défini par un responsable' },
  { code: 'USER_DELETE', label: 'Mise en corbeille utilisateur' },
  { code: 'LEAD_CREATE', label: 'Création prospect' },
  { code: 'LEAD_UPDATE', label: 'Mise à jour prospect' },
  { code: 'LEAD_DELETE', label: 'Mise en corbeille prospect' },
  { code: 'GOAL_CREATE', label: 'Création objectif' },
  { code: 'GOAL_UPDATE', label: 'Mise à jour objectif' },
  { code: 'GOAL_DELETE', label: 'Mise en corbeille objectif' },
  { code: 'TRASH_RESTORE', label: 'Restauration' },
  { code: 'TRASH_PURGE', label: 'Suppression définitive' },
];

const ENTITY_FILTER_OPTIONS: Array<{ type: string; label: string }> = [
  { type: 'User', label: 'Utilisateur' },
  { type: 'Lead', label: 'Prospect' },
  { type: 'Client', label: 'Client' },
  { type: 'SalesGoal', label: 'Objectif' },
  { type: 'LeadAttachment', label: 'Pièce jointe' },
];

type ProfileActionHistoryProps = {
  userId: string;
  isSelf: boolean;
  userName?: string;
};

function formatEntityLabel(item: ActionLogItem): string {
  if (item.metadata && typeof item.metadata.label === 'string') {
    return item.metadata.label;
  }
  if (item.entityType && item.entityId) {
    const shortId =
      item.entityId.length > 10
        ? `${item.entityId.slice(0, 8)}…`
        : item.entityId;
    return `${item.entityType} (${shortId})`;
  }
  return '—';
}

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

export function ProfileActionHistory({
  userId,
  isSelf,
  userName,
}: ProfileActionHistoryProps) {
  const [data, setData] = useState<ActionHistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersUi, setFiltersUi] = useState<FiltersState>(EMPTY_FILTERS);
  const [filtersApplied, setFiltersApplied] =
    useState<FiltersState>(EMPTY_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const hasActiveFilters = useMemo(
    () =>
      !!(
        filtersApplied.from ||
        filtersApplied.to ||
        filtersApplied.q ||
        filtersApplied.actions.length ||
        filtersApplied.entities.length
      ),
    [filtersApplied],
  );

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page) });
      if (filtersApplied.from) params.set('from', filtersApplied.from);
      if (filtersApplied.to) params.set('to', filtersApplied.to);
      if (filtersApplied.actions.length) {
        params.set('action', filtersApplied.actions.join(','));
      }
      if (filtersApplied.entities.length) {
        params.set('entityType', filtersApplied.entities.join(','));
      }
      if (filtersApplied.q.trim()) params.set('q', filtersApplied.q.trim());

      const res = await fetch(
        `/api/users/${userId}/action-history?${params.toString()}`,
        { cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setData(null);
        setError(
          typeof json?.error === 'string'
            ? json.error
            : "Impossible de charger l'historique.",
        );
        return;
      }
      setData(json as ActionHistoryResponse);
    } catch {
      setData(null);
      setError("Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [userId, page, filtersApplied]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const title = isSelf
    ? 'Mon historique des actions'
    : `Historique des actions${userName ? ` de ${userName}` : ''}`;

  return (
    <NeumoCard className='bg-white p-5 shadow-neu-soft flex flex-col gap-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <History className='w-4 h-4 text-primary' />
          <h2 className='text-sm font-semibold text-primary'>{title}</h2>
        </div>
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='text-[11px] h-8 px-2.5 gap-1'
            >
              <Filter className='w-3.5 h-3.5' />
              Filtrer
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtrer l&apos;historique</SheetTitle>
            </SheetHeader>
            <div className='flex flex-col gap-4 mt-3 text-xs'>
              <div className='space-y-1'>
                <div className='text-[11px] text-gray-500'>Période</div>
                <div className='flex gap-2'>
                  <input
                    type='date'
                    value={filtersUi.from}
                    onChange={(e) =>
                      setFiltersUi((prev) => ({
                        ...prev,
                        from: e.target.value,
                      }))
                    }
                    className='flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                  />
                  <input
                    type='date'
                    value={filtersUi.to}
                    onChange={(e) =>
                      setFiltersUi((prev) => ({
                        ...prev,
                        to: e.target.value,
                      }))
                    }
                    className='flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                  />
                </div>
              </div>

              <div className='space-y-1'>
                <div className='text-[11px] text-gray-500'>Type d&apos;action</div>
                <select
                  value={filtersUi.actions[0] ?? ''}
                  onChange={(e) =>
                    setFiltersUi((prev) => ({
                      ...prev,
                      actions: e.target.value ? [e.target.value] : [],
                    }))
                  }
                  className='w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                >
                  <option value=''>Tous les types</option>
                  {ACTION_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-1'>
                <div className='text-[11px] text-gray-500'>
                  Type d&apos;entité
                </div>
                <select
                  value={filtersUi.entities[0] ?? ''}
                  onChange={(e) =>
                    setFiltersUi((prev) => ({
                      ...prev,
                      entities: e.target.value ? [e.target.value] : [],
                    }))
                  }
                  className='w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                >
                  <option value=''>Toutes les entités</option>
                  {ENTITY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-1'>
                <div className='text-[11px] text-gray-500'>Recherche</div>
                <input
                  type='search'
                  value={filtersUi.q}
                  onChange={(e) =>
                    setFiltersUi((prev) => ({ ...prev, q: e.target.value }))
                  }
                  placeholder='Mots-clés dans le résumé…'
                  className='w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                />
              </div>

              <div className='mt-2 flex justify-between gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='text-[11px]'
                  onClick={() => setFiltersUi(EMPTY_FILTERS)}
                >
                  Réinitialiser
                </Button>
                <div className='flex gap-2'>
                  {hasActiveFilters && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='text-[11px] text-gray-600'
                      onClick={() => {
                        setFiltersApplied(EMPTY_FILTERS);
                        setFiltersUi(EMPTY_FILTERS);
                        setPage(1);
                        setIsFilterOpen(false);
                      }}
                    >
                      <X className='w-3 h-3 mr-1' />
                      Effacer les filtres
                    </Button>
                  )}
                  <Button
                    type='button'
                    size='sm'
                    className='text-[11px]'
                    onClick={() => {
                      setFiltersApplied(filtersUi);
                      setPage(1);
                      setIsFilterOpen(false);
                    }}
                  >
                    Appliquer
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {hasActiveFilters && (
        <div className='flex flex-wrap items-center gap-1 text-[11px] text-gray-500'>
          <span>Filtres actifs :</span>
          {filtersApplied.from && (
            <Badge variant='outline' className='bg-gray-50'>
              Du {filtersApplied.from}
            </Badge>
          )}
          {filtersApplied.to && (
            <Badge variant='outline' className='bg-gray-50'>
              Au {filtersApplied.to}
            </Badge>
          )}
          {filtersApplied.actions.map((code) => {
            const opt = ACTION_FILTER_OPTIONS.find((a) => a.code === code);
            return (
              <Badge
                key={code}
                variant='outline'
                className='bg-blue-50 text-blue-700 border-blue-200'
              >
                {opt?.label ?? code}
              </Badge>
            );
          })}
          {filtersApplied.entities.map((type) => {
            const opt = ENTITY_FILTER_OPTIONS.find((e) => e.type === type);
            return (
              <Badge
                key={type}
                variant='outline'
                className='bg-emerald-50 text-emerald-700 border-emerald-200'
              >
                {opt?.label ?? type}
              </Badge>
            );
          })}
          {filtersApplied.q && (
            <Badge variant='outline' className='bg-gray-50'>
              « {filtersApplied.q} »
            </Badge>
          )}
        </div>
      )}

      {loading && (
        <p className='text-xs text-gray-500'>Chargement de l&apos;historique…</p>
      )}

      {!loading && error && (
        <p className='text-xs text-red-600'>{error}</p>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <p className='text-xs text-gray-500'>
          Aucune action enregistrée pour le moment.
        </p>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className='overflow-x-auto'>
            <table className='min-w-full text-xs'>
              <thead className='text-gray-500 border-b border-gray-100'>
                <tr>
                  <th className='py-2 text-left font-medium'>Date</th>
                  <th className='py-2 text-left font-medium'>Action</th>
                  <th className='py-2 text-left font-medium'>Entité</th>
                </tr>
              </thead>
              <tbody className='text-gray-700'>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className='border-b border-gray-50 hover:bg-gray-50/60'
                  >
                    <td className='py-2.5 whitespace-nowrap text-gray-500'>
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className='py-2.5 font-medium'>{item.summary}</td>
                    <td className='py-2.5 text-gray-500'>
                      {formatEntityLabel(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='flex items-center justify-between gap-2 pt-1'>
            <span className='text-[11px] text-gray-500'>
              Page {data.page} sur {data.totalPages} ({data.total} action
              {data.total > 1 ? 's' : ''})
            </span>
            <div className='flex gap-2'>
              <button
                type='button'
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className='px-3 py-1 rounded-lg border border-gray-200 text-[11px] font-medium disabled:opacity-40 hover:bg-gray-50'
              >
                Précédent
              </button>
              <button
                type='button'
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className='px-3 py-1 rounded-lg border border-gray-200 text-[11px] font-medium disabled:opacity-40 hover:bg-gray-50'
              >
                Suivant
              </button>
            </div>
          </div>
        </>
      )}
    </NeumoCard>
  );
}
