'use client';

import ClientEditSheet from '@/components/ClientEditSheet';
import ClientViewSheet from '@/components/ClientViewSheet';
import ClientCard from '@/components/clients/ClientCard';
import ClientsOnboardingCarousel from '@/components/clients/ClientsOnboardingCarousel';
import NeumoCard from '@/components/NeumoCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Building2,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const CLIENTS_PER_PAGE = 10;

export interface Client {
  id: string;
  name: string;
  contact?: string | null;
  totalRevenue: number;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  civility?: string | null;
  activityDomain?: string | null;
  companyName?: string | null;
  location?: string | null;
  notes?: string | null;
  company?: { id: string; name: string } | null;
  convertedById?: string | null;
  convertedAt?: string | null;
  convertedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

type ClientFilters = {
  source: string;
  convertedBy: string;
  location: string;
  companyName: string;
  convertedFrom: string;
  convertedTo: string;
  revenueMin: string;
  revenueMax: string;
};

const DEFAULT_FILTERS: ClientFilters = {
  source: '',
  convertedBy: '',
  location: '',
  companyName: '',
  convertedFrom: '',
  convertedTo: '',
  revenueMin: '',
  revenueMax: '',
};

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

function formatCaShort(amount: number) {
  return amount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  });
}

function clientCompanyLabel(c: Client): string {
  return (
    c.companyName?.trim() ||
    c.company?.name?.trim() ||
    ''
  );
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

function ClientsPageInner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(data);
        }
      } catch {
        // silencieux pour le MVP
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const source = c.source?.trim();
      if (source) set.add(source);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [clients]);

  const availableConverters = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => {
      if (c.convertedBy?.id && c.convertedBy.name?.trim()) {
        map.set(c.convertedBy.id, c.convertedBy.name.trim());
      }
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [clients]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const location = c.location?.trim();
      if (location) set.add(location);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [clients]);

  const availableCompanies = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const name = clientCompanyLabel(c);
      if (name) set.add(name);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [clients]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.source) n += 1;
    if (filters.convertedBy) n += 1;
    if (filters.location) n += 1;
    if (filters.companyName) n += 1;
    if (filters.convertedFrom || filters.convertedTo) n += 1;
    if (filters.revenueMin || filters.revenueMax) n += 1;
    return n;
  }, [filters]);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    let rows = clients;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.contact && c.contact.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.companyName && c.companyName.toLowerCase().includes(q)) ||
          (c.company?.name && c.company.name.toLowerCase().includes(q)) ||
          (c.convertedBy?.name &&
            c.convertedBy.name.toLowerCase().includes(q)) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.source && c.source.toLowerCase().includes(q)),
      );
    }

    if (filters.source) {
      rows = rows.filter((c) => (c.source?.trim() ?? '') === filters.source);
    }

    if (filters.convertedBy) {
      rows = rows.filter((c) => c.convertedById === filters.convertedBy);
    }

    if (filters.location) {
      rows = rows.filter(
        (c) => (c.location?.trim() ?? '') === filters.location,
      );
    }

    if (filters.companyName) {
      rows = rows.filter(
        (c) => clientCompanyLabel(c) === filters.companyName,
      );
    }

    if (filters.convertedFrom) {
      const from = new Date(`${filters.convertedFrom}T00:00:00`);
      rows = rows.filter((c) => {
        if (!c.convertedAt) return false;
        const d = new Date(c.convertedAt);
        return !Number.isNaN(d.getTime()) && d >= from;
      });
    }

    if (filters.convertedTo) {
      const to = new Date(`${filters.convertedTo}T23:59:59.999`);
      rows = rows.filter((c) => {
        if (!c.convertedAt) return false;
        const d = new Date(c.convertedAt);
        return !Number.isNaN(d.getTime()) && d <= to;
      });
    }

    const minRevenue = filters.revenueMin.trim()
      ? Number(filters.revenueMin.replace(/\s/g, ''))
      : null;
    const maxRevenue = filters.revenueMax.trim()
      ? Number(filters.revenueMax.replace(/\s/g, ''))
      : null;

    if (minRevenue != null && !Number.isNaN(minRevenue)) {
      rows = rows.filter((c) => c.totalRevenue >= minRevenue);
    }
    if (maxRevenue != null && !Number.isNaN(maxRevenue)) {
      rows = rows.filter((c) => c.totalRevenue <= maxRevenue);
    }

    return rows;
  }, [clients, query, filters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filtered.slice(start, start + CLIENTS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CLIENTS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filters]);

  const handleUpdated = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
    setEditClient(null);
  };

  const converterLabel =
    availableConverters.find((c) => c.id === filters.convertedBy)?.name ??
    undefined;

  const revenueChipValue =
    filters.revenueMin || filters.revenueMax
      ? `${filters.revenueMin ? formatCaShort(Number(filters.revenueMin) || 0) : '…'} → ${
          filters.revenueMax
            ? formatCaShort(Number(filters.revenueMax) || 0)
            : '…'
        }`
      : undefined;

  return (
    <>
      <section className='mt-2 flex flex-col gap-4'>
        <ClientsOnboardingCarousel
          onShowList={() => setViewMode('table')}
          onFocusSearch={() => {
            window.setTimeout(() => searchInputRef.current?.focus(), 350);
          }}
          onShowGrid={() => setViewMode('grid')}
        />
      </section>

      <NeumoCard
        id='clients-liste'
        className='mt-4 scroll-mt-4 p-4 flex flex-col gap-4 bg-white'
      >
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <h2 className='text-sm font-semibold text-primary'>
              Liste des clients
            </h2>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100 text-xs w-full sm:w-56'>
                <Search className='w-4 h-4 text-gray-400 shrink-0' />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Rechercher un client…'
                  className='bg-transparent outline-none flex-1 text-[11px] text-gray-700 min-w-0'
                />
                {query ? (
                  <button
                    type='button'
                    onClick={() => setQuery('')}
                    className='rounded-full p-0.5 text-gray-400 hover:text-gray-600'
                    aria-label='Effacer la recherche'
                  >
                    <X className='h-3 w-3' />
                  </button>
                ) : null}
              </div>

              <button
                type='button'
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                  activeFilterCount > 0 || filtersOpen
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Filter className='h-3.5 w-3.5' />
                Filtre
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>

              <span className='text-[11px] text-gray-500'>
                {filtered.length} client{filtered.length !== 1 ? 's' : ''}
              </span>

              <div className='inline-flex items-center rounded-full bg-gray-50 border border-gray-100 p-0.5'>
                <button
                  type='button'
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] ${
                    viewMode === 'table'
                      ? 'bg-primary text-white shadow-neu'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title='Vue tableau'
                >
                  <List className='w-3.5 h-3.5' />
                </button>
                <button
                  type='button'
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] ${
                    viewMode === 'grid'
                      ? 'bg-primary text-white shadow-neu'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title='Vue cartes'
                >
                  <LayoutGrid className='w-3.5 h-3.5' />
                </button>
              </div>
            </div>
          </div>

          {(filtersOpen || activeFilterCount > 0) && (
            <div className='flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-[#fafaff] px-3 py-2.5'>
              <Popover>
                <PopoverTrigger asChild>
                  <button type='button' className='outline-none'>
                    <FilterChipButton
                      label='Source'
                      value={filters.source || undefined}
                      active={Boolean(filters.source)}
                      onClear={() =>
                        setFilters((prev) => ({ ...prev, source: '' }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-56 space-y-2 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Source
                  </p>
                  <select
                    value={filters.source}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        source: e.target.value,
                      }))
                    }
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
                      label='Converti par'
                      value={converterLabel}
                      active={Boolean(filters.convertedBy)}
                      onClear={() =>
                        setFilters((prev) => ({ ...prev, convertedBy: '' }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-56 space-y-2 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Converti par
                  </p>
                  <select
                    value={filters.convertedBy}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        convertedBy: e.target.value,
                      }))
                    }
                    className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                  >
                    <option value=''>Tous</option>
                    {availableConverters.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button type='button' className='outline-none'>
                    <FilterChipButton
                      label='Société'
                      value={filters.companyName || undefined}
                      active={Boolean(filters.companyName)}
                      onClear={() =>
                        setFilters((prev) => ({ ...prev, companyName: '' }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-64 space-y-2 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Société / entreprise
                  </p>
                  <select
                    value={filters.companyName}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        companyName: e.target.value,
                      }))
                    }
                    className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                  >
                    <option value=''>Toutes</option>
                    {availableCompanies.map((name) => (
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
                      label='Ville'
                      value={filters.location || undefined}
                      active={Boolean(filters.location)}
                      onClear={() =>
                        setFilters((prev) => ({ ...prev, location: '' }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-56 space-y-2 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Ville
                  </p>
                  <select
                    value={filters.location}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                  >
                    <option value=''>Toutes</option>
                    {availableLocations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button type='button' className='outline-none'>
                    <FilterChipButton
                      label='Date de conversion'
                      value={
                        filters.convertedFrom || filters.convertedTo
                          ? `${filters.convertedFrom ? formatFilterDate(filters.convertedFrom) : '…'} → ${filters.convertedTo ? formatFilterDate(filters.convertedTo) : '…'}`
                          : undefined
                      }
                      active={Boolean(
                        filters.convertedFrom || filters.convertedTo,
                      )}
                      onClear={() =>
                        setFilters((prev) => ({
                          ...prev,
                          convertedFrom: '',
                          convertedTo: '',
                        }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-64 space-y-3 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Date de conversion
                  </p>
                  <label className='flex flex-col gap-1'>
                    <span className='text-[10px] text-gray-500'>Du</span>
                    <DatePicker
                      value={filters.convertedFrom}
                      max={filters.convertedTo || undefined}
                      placeholder='Date de début'
                      onChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          convertedFrom: value,
                        }))
                      }
                    />
                  </label>
                  <label className='flex flex-col gap-1'>
                    <span className='text-[10px] text-gray-500'>Au</span>
                    <DatePicker
                      value={filters.convertedTo}
                      min={filters.convertedFrom || undefined}
                      placeholder='Date de fin'
                      onChange={(value) =>
                        setFilters((prev) => ({
                          ...prev,
                          convertedTo: value,
                        }))
                      }
                    />
                  </label>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button type='button' className='outline-none'>
                    <FilterChipButton
                      label='CA total'
                      value={revenueChipValue}
                      active={Boolean(
                        filters.revenueMin || filters.revenueMax,
                      )}
                      onClear={() =>
                        setFilters((prev) => ({
                          ...prev,
                          revenueMin: '',
                          revenueMax: '',
                        }))
                      }
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-64 space-y-3 p-3'>
                  <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    CA total (XOF)
                  </p>
                  <label className='flex flex-col gap-1'>
                    <span className='text-[10px] text-gray-500'>Minimum</span>
                    <input
                      type='number'
                      min={0}
                      inputMode='numeric'
                      value={filters.revenueMin}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          revenueMin: e.target.value,
                        }))
                      }
                      placeholder='0'
                      className='h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                    />
                  </label>
                  <label className='flex flex-col gap-1'>
                    <span className='text-[10px] text-gray-500'>Maximum</span>
                    <input
                      type='number'
                      min={0}
                      inputMode='numeric'
                      value={filters.revenueMax}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          revenueMax: e.target.value,
                        }))
                      }
                      placeholder='Illimité'
                      className='h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
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
        </div>

        {loading ? (
          <div className='flex flex-col gap-3'>
            <SkeletonLoader className='h-10 w-full' />
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} className='h-44 w-full rounded-2xl' />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className='text-xs text-gray-500'>
            {query || activeFilterCount > 0
              ? 'Aucun client ne correspond à vos critères.'
              : "Aucun client enregistré pour le moment. Convertissez un lead en contact pour l'ajouter ici."}
          </p>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className='grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {paginated.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onView={() => setViewClient(client)}
                    onEdit={() => setEditClient(client)}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead>Nom du client</TableHead>
                    <TableHead>Société</TableHead>
                    <TableHead>Converti par</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className='text-right'>CA total</TableHead>
                    <TableHead className='text-right w-20'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className='text-primary font-medium'>
                        {client.name}
                      </TableCell>
                      <TableCell>
                        {clientCompanyLabel(client) || <TableEmpty />}
                      </TableCell>
                      <TableCell>
                        {client.convertedBy?.name ?? <TableEmpty />}
                      </TableCell>
                      <TableCell>
                        {client.contact ?? 'Aucun contact'}
                      </TableCell>
                      <TableCell className='text-right'>
                        {client.totalRevenue.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'XOF',
                        })}
                      </TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type='button'
                              className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-500 hover:text-primary border border-gray-100'
                            >
                              <MoreHorizontal className='w-4 h-4' />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side='left' align='end'>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setViewClient(client);
                              }}
                            >
                              <Eye className='w-4 h-4 mr-2' />
                              Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setEditClient(client);
                              }}
                            >
                              <Pencil className='w-4 h-4 mr-2' />
                              Modifier
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {filtered.length > 0 && totalPages > 1 && (
              <div className='flex items-center justify-between gap-4 pt-4 border-t border-gray-100'>
                <div className='text-[11px] text-gray-500'>
                  Affichage de {(currentPage - 1) * CLIENTS_PER_PAGE + 1} à{' '}
                  {Math.min(currentPage * CLIENTS_PER_PAGE, filtered.length)}{' '}
                  sur {filtered.length} clients
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    title='Page précédente'
                  >
                    <ChevronLeft className='w-4 h-4' />
                  </button>
                  <span className='text-[11px] text-gray-600 px-2'>
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    title='Page suivante'
                  >
                    <ChevronRight className='w-4 h-4' />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </NeumoCard>

      <ClientViewSheet
        open={!!viewClient}
        client={viewClient}
        onClose={() => setViewClient(null)}
        onEdit={(client) => {
          setViewClient(null);
          setEditClient(client);
        }}
      />
      <ClientEditSheet
        open={!!editClient}
        client={editClient}
        onClose={() => setEditClient(null)}
        onUpdated={handleUpdated}
      />
    </>
  );
}

const ClientsPage = withDashboardLayout(ClientsPageInner, {
  title: 'Gestion Clients',
  subtitle: 'Gérez la liste de vos clients existants, distincte des leads.',
  titleIcon: Building2,
});
export default ClientsPage;
