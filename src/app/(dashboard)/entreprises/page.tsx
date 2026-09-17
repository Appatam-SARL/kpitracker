'use client';

import InstantSearchBar from '@/components/InstantSearchBar';
import NeumoCard from '@/components/NeumoCard';
import ProspectCreateSheet from '@/components/ProspectCreateSheet';
import SkeletonLoader from '@/components/SkeletonLoader';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatLeadTypeLabel, LEAD_TYPE_OPTIONS } from '@/config/lead-options';
import {
  buildProspectSearchPlaceholder,
  DEFAULT_PROSPECT_SEARCH_FIELDS,
  PROSPECT_SEARCH_FIELDS,
  prospectMatchesSearchQuery,
  type ProspectSearchFieldId,
} from '@/lib/prospect-search';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Factory,
  Filter,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PER_PAGE = 15;

type ContactPreview = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  ownerName?: string | null;
};

type EntrepriseProspect = {
  id: string;
  name: string;
  leadType?: string | null;
  activitySector?: string | null;
  location?: string | null;
  geographicSituation?: string | null;
  source?: string | null;
  logoUrl?: string | null;
  contactsCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { id: string; name: string } | null;
  contactsPreview?: ContactPreview[];
};

type ListView = 'all' | 'mine';
type DisplayMode = 'liste' | 'grid';
type SortKey = 'name' | 'createdAt' | 'updatedAt' | 'location';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { value: `${SortKey}:${SortDir}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Date de création (récent)' },
  { value: 'createdAt:asc', label: 'Date de création (ancien)' },
  { value: 'updatedAt:desc', label: 'Dernière activité' },
  { value: 'name:asc', label: 'Nom (A → Z)' },
  { value: 'name:desc', label: 'Nom (Z → A)' },
  { value: 'location:asc', label: 'Ville (A → Z)' },
];

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'E';
}

function creatorName(p: EntrepriseProspect): string | null {
  return p.createdBy?.name?.trim() || null;
}

function toCsvCell(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatFilterDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function FilterChipButton({
  label,
  value,
  active,
  onClear,
}: {
  label: string;
  value?: string;
  active?: boolean;
  onClear?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] transition-colors ${
        active
          ? 'border-primary/30 bg-primary/5 text-primary'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      <span className='font-medium'>{label}</span>
      {value ? (
        <span className='max-w-36 truncate text-primary/90'>{value}</span>
      ) : (
        <ChevronDown className='h-3 w-3 text-gray-400' />
      )}
      {active && onClear ? (
        <button
          type='button'
          aria-label={`Effacer le filtre ${label}`}
          className='ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-rose-600'
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className='h-3 w-3' />
        </button>
      ) : null}
    </span>
  );
}

function EntreprisesPageInner() {
  const router = useRouter();
  const [items, setItems] = useState<EntrepriseProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listView, setListView] = useState<ListView>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('liste');
  const [query, setQuery] = useState('');
  const [searchFields, setSearchFields] = useState<ProspectSearchFieldId[]>([
    ...DEFAULT_PROSPECT_SEARCH_FIELDS,
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (listView === 'mine') params.set('mine', '1');
      const qs = params.toString();
      const res = await fetch(`/api/prospects${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? 'Accès refusé'
            : 'Impossible de charger les entreprises',
        );
      }
      const data = (await res.json()) as EntrepriseProspect[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listView]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const availableCreators = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => {
      const name = creatorName(p);
      if (name) set.add(name);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((p) => {
      const source = p.source?.trim();
      if (source) set.add(source);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (ownerFilter) n += 1;
    if (leadTypeFilter) n += 1;
    if (sourceFilter) n += 1;
    if (createdFrom) n += 1;
    if (createdTo) n += 1;
    return n;
  }, [ownerFilter, leadTypeFilter, sourceFilter, createdFrom, createdTo]);

  const clearFilters = () => {
    setOwnerFilter('');
    setLeadTypeFilter('');
    setSourceFilter('');
    setCreatedFrom('');
    setCreatedTo('');
  };

  const filtered = useMemo(() => {
    let rows = items;

    if (query.trim()) {
      rows = rows.filter((p) =>
        prospectMatchesSearchQuery(p, query, searchFields),
      );
    }

    if (ownerFilter) {
      rows = rows.filter((p) => creatorName(p) === ownerFilter);
    }

    if (leadTypeFilter) {
      rows = rows.filter((p) => (p.leadType ?? '') === leadTypeFilter);
    }

    if (sourceFilter) {
      rows = rows.filter(
        (p) => (p.source?.trim() ?? '') === sourceFilter,
      );
    }

    if (createdFrom) {
      const from = new Date(`${createdFrom}T00:00:00`);
      rows = rows.filter((p) => p.createdAt && new Date(p.createdAt) >= from);
    }
    if (createdTo) {
      const to = new Date(`${createdTo}T23:59:59`);
      rows = rows.filter((p) => p.createdAt && new Date(p.createdAt) <= to);
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av =
        sortKey === 'name'
          ? a.name
          : sortKey === 'location'
            ? a.location ?? ''
            : sortKey === 'createdAt'
              ? a.createdAt ?? ''
              : a.updatedAt ?? '';
      const bv =
        sortKey === 'name'
          ? b.name
          : sortKey === 'location'
            ? b.location ?? ''
            : sortKey === 'createdAt'
              ? b.createdAt ?? ''
              : b.updatedAt ?? '';
      return String(av).localeCompare(String(bv), 'fr', { numeric: true }) * dir;
    });

    return rows;
  }, [
    items,
    query,
    searchFields,
    ownerFilter,
    leadTypeFilter,
    sourceFilter,
    createdFrom,
    createdTo,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    query,
    searchFields,
    listView,
    ownerFilter,
    leadTypeFilter,
    sourceFilter,
    createdFrom,
    createdTo,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openFiche = (id: string) => {
    router.push(`/entreprises/${id}`);
  };

  const exportCsv = () => {
    const rows = filtered;
    const header = [
      'Nom',
      "Type d'entreprise",
      'Ville',
      'Secteur',
      'Source',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((p) =>
        [
          p.name,
          formatLeadTypeLabel(p.leadType),
          p.location ?? '',
          p.activitySector ?? '',
          p.source ?? '',
        ]
          .map((c) => toCsvCell(c))
          .join(';'),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entreprises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'location' ? 'asc' : 'desc');
    }
  };

  const SortHint = ({ column }: { column: SortKey }) =>
    sortKey === column ? (
      <span className='ml-1 text-[10px] opacity-70'>
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    ) : null;

  return (
    <>
      <section className='mt-2 flex flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end'>
          <div
            className='flex shrink-0 self-start rounded-full bg-white p-0.5 shadow-neu'
            role='group'
            aria-label="Mode d'affichage"
          >
            {(
              [
                { id: 'liste' as const, label: 'Liste', Icon: List },
                { id: 'grid' as const, label: 'Grille', Icon: LayoutGrid },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type='button'
                onClick={() => setDisplayMode(id)}
                className={`rounded-full p-2 text-xs transition-colors ${
                  displayMode === id
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                title={label}
                aria-label={label}
                aria-pressed={displayMode === id}
              >
                <Icon className='h-4 w-4' />
              </button>
            ))}
          </div>
        </div>

        <div
          className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end'
          role='group'
          aria-label='Actions prospects'
        >
          <button
            type='button'
            onClick={() => setCreateOpen(true)}
            className='col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-white shadow-neu transition hover:brightness-105 sm:order-3 sm:col-span-1 sm:min-w-42'
          >
            <Plus className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>Ajouter des prospects</span>
          </button>
          <button
            type='button'
            onClick={() => void fetchList()}
            title='Actualiser'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-neu transition hover:bg-gray-50 sm:min-w-38'
          >
            <RefreshCw className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>Actualiser</span>
          </button>
          <button
            type='button'
            onClick={exportCsv}
            title='Exporter les prospects'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-neu transition hover:bg-gray-50 sm:min-w-38'
          >
            <Download className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>Exporter</span>
          </button>
        </div>

        <div className='flex items-center gap-1 border-b border-gray-100'>
          {(
            [
              { id: 'all' as const, label: 'Tous les prospects' },
              { id: 'mine' as const, label: 'Mes prospects' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setListView(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                listView === tab.id
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {listView === tab.id && (
                <span className='absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary' />
              )}
            </button>
          ))}
        </div>
      </section>

      <NeumoCard className='mt-4 flex flex-col gap-3 bg-white p-4'>
        <div className='flex items-center gap-2'>
          <InstantSearchBar
            query={query}
            onQueryChange={setQuery}
            placeholder={buildProspectSearchPlaceholder(searchFields)}
            storageKey='crm_entreprises_search_history'
            className='min-w-0 flex-1'
            fieldOptions={PROSPECT_SEARCH_FIELDS}
            searchFields={searchFields}
            onSearchFieldsChange={(fields) =>
              setSearchFields(fields as ProspectSearchFieldId[])
            }
            defaultSearchFields={DEFAULT_PROSPECT_SEARCH_FIELDS}
          />

          <button
            type='button'
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] ${
              activeFilterCount > 0 || filtersOpen
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Filter className='h-3.5 w-3.5' />
            Filtre{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type='button'
                className='inline-flex h-9 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 text-[11px] text-gray-600 outline-none hover:bg-gray-100 sm:max-w-none'
              >
                <span className='hidden sm:inline'>Trier</span>
                <span className='max-w-36 truncate font-medium text-primary'>
                  {SORT_OPTIONS.find(
                    (opt) => opt.value === `${sortKey}:${sortDir}`,
                  )?.label ?? 'Choisir'}
                </span>
                <ChevronDown className='h-3 w-3 shrink-0 text-gray-400' />
              </button>
            </PopoverTrigger>
            <PopoverContent className='w-56 space-y-1 p-2'>
              <p className='px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                Trier par
              </p>
              {SORT_OPTIONS.map((opt) => {
                const active = `${sortKey}:${sortDir}` === opt.value;
                return (
                  <PopoverClose key={opt.value} asChild>
                    <button
                      type='button'
                      onClick={() => {
                        const [k, d] = opt.value.split(':') as [
                          SortKey,
                          SortDir,
                        ];
                        setSortKey(k);
                        setSortDir(d);
                      }}
                      className={`flex w-full items-center rounded-xl px-2.5 py-2 text-left text-[11px] transition-colors ${
                        active
                          ? 'bg-primary/5 font-medium text-primary'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </PopoverClose>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        {(filtersOpen || activeFilterCount > 0) && (
          <div className='flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-[#fafaff] px-3 py-2.5'>
            <Popover>
              <PopoverTrigger asChild>
                <button type='button' className='outline-none'>
                  <FilterChipButton
                    label='Ajouté par'
                    value={ownerFilter || undefined}
                    active={Boolean(ownerFilter)}
                    onClear={() => setOwnerFilter('')}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-56 space-y-2 p-3'>
                <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                  Ajouté par
                </p>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                >
                  <option value=''>Tous</option>
                  {availableCreators.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button type='button' className='outline-none'>
                  <FilterChipButton
                    label="Type d'entreprise"
                    value={
                      leadTypeFilter
                        ? formatLeadTypeLabel(leadTypeFilter)
                        : undefined
                    }
                    active={Boolean(leadTypeFilter)}
                    onClear={() => setLeadTypeFilter('')}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-64 space-y-2 p-3'>
                <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                  Type d&apos;entreprise
                </p>
                <select
                  value={leadTypeFilter}
                  onChange={(e) => setLeadTypeFilter(e.target.value)}
                  className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                >
                  <option value=''>Tous</option>
                  {LEAD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button type='button' className='outline-none'>
                  <FilterChipButton
                    label='Source'
                    value={sourceFilter || undefined}
                    active={Boolean(sourceFilter)}
                    onClear={() => setSourceFilter('')}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-56 space-y-2 p-3'>
                <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                  Source
                </p>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                >
                  <option value=''>Toutes</option>
                  {availableSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button type='button' className='outline-none'>
                  <FilterChipButton
                    label='Date de création'
                    value={
                      createdFrom || createdTo
                        ? `${createdFrom ? formatFilterDate(createdFrom) : '…'} → ${createdTo ? formatFilterDate(createdTo) : '…'}`
                        : undefined
                    }
                    active={Boolean(createdFrom || createdTo)}
                    onClear={() => {
                      setCreatedFrom('');
                      setCreatedTo('');
                    }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-64 space-y-3 p-3'>
                <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                  Date de création
                </p>
                <label className='flex flex-col gap-1'>
                  <span className='text-[10px] text-gray-500'>Du</span>
                  <DatePicker
                    value={createdFrom}
                    onChange={setCreatedFrom}
                    max={createdTo || undefined}
                    placeholder='Date de début'
                  />
                </label>
                <label className='flex flex-col gap-1'>
                  <span className='text-[10px] text-gray-500'>Au</span>
                  <DatePicker
                    value={createdTo}
                    onChange={setCreatedTo}
                    min={createdFrom || undefined}
                    placeholder='Date de fin'
                  />
                </label>
              </PopoverContent>
            </Popover>

            {activeFilterCount > 0 && (
              <button
                type='button'
                onClick={clearFilters}
                className='inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] text-rose-600 hover:bg-rose-50'
              >
                <X className='h-3 w-3' />
                Tout supprimer
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className='flex flex-col gap-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} className='h-11 w-full' />
            ))}
          </div>
        ) : error ? (
          <p className='text-xs text-red-600'>{error}</p>
        ) : filtered.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center space-y-3'>
            <p className='text-xs text-gray-500'>
              {query || activeFilterCount > 0
                ? 'Aucun prospect ne correspond à vos critères.'
                : listView === 'mine'
                  ? 'Vous n’avez pas encore de prospect associé à vos contacts.'
                  : 'Aucun prospect pour le moment.'}
            </p>
            {!query && activeFilterCount === 0 && (
              <button
                type='button'
                onClick={() => setCreateOpen(true)}
                className='inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[11px] font-medium text-white'
              >
                <Plus className='h-3.5 w-3.5' />
                Ajouter un prospect
              </button>
            )}
          </div>
        ) : (
          <>
            {displayMode === 'liste' ? (
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead>
                      <button
                        type='button'
                        onClick={() => toggleSort('name')}
                        className='inline-flex items-center hover:text-primary'
                      >
                        Nom de l&apos;entreprise
                        <SortHint column='name' />
                      </button>
                    </TableHead>
                    <TableHead>Type d&apos;entreprise</TableHead>
                    <TableHead>Secteur d&apos;activité</TableHead>
                    <TableHead>
                      <button
                        type='button'
                        onClick={() => toggleSort('location')}
                        className='inline-flex items-center hover:text-primary'
                      >
                        Ville
                        <SortHint column='location' />
                      </button>
                    </TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className='text-right w-14'>Fiche</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((entreprise) => (
                    <TableRow
                      key={entreprise.id}
                      className='cursor-pointer'
                      onClick={() => openFiche(entreprise.id)}
                    >
                      <TableCell>
                        <div className='flex min-w-0 items-center gap-2.5'>
                          <div className='flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/10 bg-primary/10 text-primary'>
                            {entreprise.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entreprise.logoUrl}
                                alt=''
                                className='h-full w-full object-contain'
                              />
                            ) : (
                              <span className='text-[10px] font-semibold'>
                                {companyInitials(entreprise.name)}
                              </span>
                            )}
                          </div>
                          <p className='truncate font-medium text-primary underline-offset-2 hover:underline'>
                            {entreprise.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className='text-gray-600'>
                        {entreprise.leadType ? (
                          formatLeadTypeLabel(entreprise.leadType)
                        ) : (
                          <TableEmpty />
                        )}
                      </TableCell>
                      <TableCell className='text-gray-600'>
                        {entreprise.activitySector?.trim() || <TableEmpty />}
                      </TableCell>
                      <TableCell>
                        {entreprise.location ?? <TableEmpty />}
                      </TableCell>
                      <TableCell className='text-gray-600'>
                        {entreprise.source?.trim() || <TableEmpty />}
                      </TableCell>
                      <TableCell
                        className='text-right'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type='button'
                          onClick={() => openFiche(entreprise.id)}
                          className='inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-500 hover:border-primary/20 hover:text-primary'
                          title='Ouvrir la fiche entreprise'
                          aria-label={`Ouvrir la fiche de ${entreprise.name}`}
                        >
                          <Eye className='h-3.5 w-3.5' />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className='grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {paginated.map((entreprise) => {
                  const contacts =
                    entreprise.contactsCount ??
                    entreprise.contactsPreview?.length ??
                    0;
                  return (
                    <button
                      key={entreprise.id}
                      type='button'
                      onClick={() => openFiche(entreprise.id)}
                      className='group flex h-full flex-col gap-3 rounded-2xl border border-white/70 bg-white/95 p-3.5 text-left shadow-neu-soft outline-none transition-all hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-neu focus-visible:ring-2 focus-visible:ring-primary/30'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex min-w-0 items-center gap-2.5'>
                          <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/10 bg-primary/10 text-primary'>
                            {entreprise.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entreprise.logoUrl}
                                alt=''
                                className='h-full w-full object-contain'
                              />
                            ) : (
                              <span className='text-[11px] font-semibold'>
                                {companyInitials(entreprise.name)}
                              </span>
                            )}
                          </div>
                          <div className='min-w-0'>
                            <h3 className='truncate text-[13px] font-semibold text-primary'>
                              {entreprise.name}
                            </h3>
                            {entreprise.leadType ? (
                              <p className='truncate text-[10px] text-gray-500'>
                                {formatLeadTypeLabel(entreprise.leadType)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-400 transition-colors group-hover:text-primary'>
                          <Eye className='h-3.5 w-3.5' />
                        </span>
                      </div>

                      <div className='flex flex-col gap-1.5 text-[11px] text-gray-600'>
                        {entreprise.activitySector?.trim() ? (
                          <p className='truncate'>
                            <span className='text-gray-400'>Secteur · </span>
                            {entreprise.activitySector}
                          </p>
                        ) : null}
                        {entreprise.location?.trim() ? (
                          <p className='inline-flex min-w-0 items-center gap-1.5'>
                            <MapPin className='h-3 w-3 shrink-0 text-gray-400' />
                            <span className='truncate'>{entreprise.location}</span>
                          </p>
                        ) : null}
                        {entreprise.source?.trim() ? (
                          <span className='inline-flex w-fit rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600'>
                            {entreprise.source}
                          </span>
                        ) : null}
                      </div>

                      <div className='mt-auto flex items-center justify-between gap-2 border-t border-gray-100/80 pt-2.5 text-[10px] text-gray-500'>
                        <span className='inline-flex items-center gap-1'>
                          <Users className='h-3 w-3' />
                          {contacts} contact{contacts !== 1 ? 's' : ''}
                        </span>
                        <span className='font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100'>
                          Voir →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className='flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-[11px] text-gray-500'>
                {filtered.length} prospect{filtered.length !== 1 ? 's' : ''}
                {totalPages > 1 ? ` · Page ${currentPage} / ${totalPages}` : ''}
              </p>
              {totalPages > 1 && (
                <div className='flex items-center gap-1'>
                  <button
                    type='button'
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className='inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-600 disabled:opacity-40'
                    aria-label='Page précédente'
                  >
                    <ChevronLeft className='h-3.5 w-3.5' />
                  </button>
                  <button
                    type='button'
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className='inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-600 disabled:opacity-40'
                    aria-label='Page suivante'
                  >
                    <ChevronRight className='h-3.5 w-3.5' />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </NeumoCard>

      <ProspectCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        afterCreateHref={(id) => `/entreprises/${id}`}
        onCreated={() => {
          setCreateOpen(false);
          void fetchList();
        }}
      />
    </>
  );
}

const EntreprisesPage = withDashboardLayout(EntreprisesPageInner, {
  title: 'Gestion des prospects',
  subtitle: 'Gérez et consultez vos prospects.',
  titleIcon: Factory,
});
export default EntreprisesPage;
