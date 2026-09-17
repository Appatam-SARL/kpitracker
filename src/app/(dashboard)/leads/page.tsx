'use client';

import LeadCard, {
  type Lead,
  type LeadContactPreview,
} from '@/components/LeadCard';
import ProspectCreateSheet from '@/components/ProspectCreateSheet';
import LeadEditSheet from '@/components/LeadEditSheet';
import LeadImportSheet from '@/components/LeadImportSheet';
import GroupCompanySelect from '@/components/GroupCompanySelect';
import LeadSearchBar from '@/components/leads/LeadSearchBar';
import LeadsOnboardingCarousel from '@/components/leads/LeadsOnboardingCarousel';
import NeumoCard from '@/components/NeumoCard';
import PipelineColumn from '@/components/PipelineColumn';
import SkeletonLoader from '@/components/SkeletonLoader';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import {
  NEGOTIATION_STAGE_FIELD_LABEL,
  NEGOTIATION_STAGE_LABELS,
  NEGOTIATION_STAGE_ORDER,
  NEGOTIATION_STAGE_STYLES,
  mapLegacyLeadStatusToNegotiationStage,
} from '@/config/negotiation-stage';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverClose,
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
import { useAuth } from '@/contexts/AuthContext';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import { isGroupHoldingScopeValue } from '@/lib/group-scope-roles';
import {
  DEFAULT_LEAD_SEARCH_FIELDS,
  leadMatchesSearchQuery,
  type LeadSearchFieldId,
} from '@/lib/lead-search';
import { isAdminOrManagerLike } from '@/lib/roles';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ContactRound,
  Download,
  Eye,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Filters = {
  status: string[];
  source: string;
  assignedTo: string;
  createdFrom: string;
  createdTo: string;
  staleDays?: number;
};

type SavedView = {
  id: string;
  name: string;
  filters: Filters;
};

interface LeadRow {
  id: string;
  prospectId: string;
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: string;
  notes?: string;
  companyName?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  geographicSituation?: string | null;
  activityDomains?: string[];
  activitySector?: string | null;
  leadType?: string | null;
  civility?: string | null;
  decisionRole?: string | null;
  crmCompanyName?: string;
  canViewFiche?: boolean;
  ownerName?: string | null;
  createdById?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function contactInitials(firstName?: string, lastName?: string) {
  const a = (firstName?.trim()?.[0] ?? '').toUpperCase();
  const b = (lastName?.trim()?.[0] ?? '').toUpperCase();
  return `${a}${b}` || '?';
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const STATUS_ORDER = [...NEGOTIATION_STAGE_ORDER];

const STATUS_LABELS: Record<string, string> = {
  ...NEGOTIATION_STAGE_LABELS,
};

const STATUS_STYLES: Record<string, string> = {
  ...NEGOTIATION_STAGE_STYLES,
};

type ViewMode = 'liste' | 'kanban' | 'grid';

const DEFAULT_FILTERS: Filters = {
  status: [],
  source: '',
  assignedTo: '',
  createdFrom: '',
  createdTo: '',
  staleDays: undefined,
};

const SYSTEM_VIEW_OPTIONS = [
  { id: 'system-all', label: 'Tous les leads' },
  { id: 'system-follow-up', label: 'Leads à relancer' },
  { id: 'system-new-week', label: 'Nouveaux leads (7 derniers jours)' },
] as const;

function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function buildSystemViewFilters(id: string): Filters {
  const today = new Date();

  if (id === 'system-follow-up') {
    // Contacts en prospection sans activité récente (7 jours)
    return {
      ...DEFAULT_FILTERS,
      status: ['EN_PROSPECTION'],
      staleDays: 7,
    };
  }

  if (id === 'system-new-week') {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      ...DEFAULT_FILTERS,
      createdFrom: toLocalISODate(from),
      createdTo: toLocalISODate(today),
    };
  }

  return { ...DEFAULT_FILTERS };
}

function LeadsPageInner() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    apiCompanyId,
  } = useGroupCompanyScope();
  const isHoldingMode = isGroupHoldingScopeValue(selectedCompanyId);

  const [query, setQuery] = useState('');
  const [searchFields, setSearchFields] = useState<LeadSearchFieldId[]>([
    ...DEFAULT_LEAD_SEARCH_FIELDS,
  ]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState<number>(25);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('system-all');
  const [showFilters, setShowFilters] = useState(false);
  const [userOptions, setUserOptions] = useState<
    { id: string; name: string; role: string }[]
  >([]);

  const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('crm_leads_views');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch {
      // silencieux
    }
  }, []);

  // Commerciaux (AGENT) : entreprise sélectionnée ou holding (toutes filiales)
  useEffect(() => {
    if (!isManagerOrAdmin) return;
    if (hasGroupScope && !apiCompanyId) {
      setUserOptions([]);
      return;
    }

    (async () => {
      try {
        const qs = new URLSearchParams({ role: 'AGENT' });
        if (hasGroupScope && apiCompanyId) {
          qs.set('companyId', apiCompanyId);
        }
        const res = await fetch(`/api/users?${qs.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setUserOptions([]);
          return;
        }
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map(
          (u: { id: string; name: string; role: string }) => ({
            id: u.id,
            name: u.name,
            role: u.role,
          }),
        );
        setUserOptions(mapped);
        setFilters((prev) =>
          prev.assignedTo && !mapped.some((u) => u.id === prev.assignedTo)
            ? { ...prev, assignedTo: '' }
            : prev,
        );
      } catch {
        setUserOptions([]);
      }
    })();
  }, [isManagerOrAdmin, hasGroupScope, apiCompanyId]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (hasGroupScope && apiCompanyId) {
        params.set('companyId', apiCompanyId);
      }
      const qs = params.toString();
      const res = await fetch(`/api/prospects${qs ? `?${qs}` : ''}`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped: LeadRow[] = (Array.isArray(data) ? data : []).flatMap(
        (p: {
          id: string;
          name: string;
          source?: string | null;
          location?: string | null;
          geographicSituation?: string | null;
          activityDomains?: string[];
          activitySector?: string | null;
          leadType?: string | null;
          notes?: string | null;
          createdAt?: string | null;
          updatedAt?: string | null;
          contactsPreview?: Array<
            LeadContactPreview & {
              negotiationStage?: string | null;
              civility?: string | null;
              decisionRole?: string | null;
              createdAt?: string | null;
              updatedAt?: string | null;
            }
          >;
        }) => {
          const preview = p.contactsPreview ?? [];
          return preview.map((c) => ({
            id: c.id,
            prospectId: p.id,
            contactId: c.id,
            firstName: c.firstName ?? '',
            lastName: c.lastName ?? '',
            email: c.email,
            phone: c.phone,
            civility: c.civility ?? null,
            decisionRole: c.decisionRole ?? null,
            jobTitle: c.jobTitle ?? null,
            source: p.source,
            companyName: p.name,
            location: p.location,
            geographicSituation: p.geographicSituation,
            activityDomains: p.activityDomains ?? [],
            activitySector: p.activitySector ?? null,
            leadType: p.leadType ?? null,
            notes: p.notes ?? undefined,
            status: mapLegacyLeadStatusToNegotiationStage(
              c.negotiationStage ?? 'EN_PROSPECTION',
            ),
            canViewFiche: c.canViewFiche !== false,
            ownerName: c.ownerName ?? null,
            createdById: c.createdById ?? null,
            createdAt: c.createdAt ?? p.createdAt ?? null,
            updatedAt: c.updatedAt ?? p.updatedAt ?? null,
          }));
        },
      );
      setLeads(mapped);
    } catch {
      // silencieux pour le MVP
    } finally {
      setLoading(false);
    }
  }, [hasGroupScope, apiCompanyId]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const filtered = useMemo(() => {
    let matched = leads.filter((lead) =>
      leadMatchesSearchQuery(lead, query, searchFields),
    );

    if (filters.status.length > 0) {
      matched = matched.filter((lead) => filters.status.includes(lead.status));
    }

    if (filters.source.trim()) {
      const sourceQuery = filters.source.trim().toLowerCase();
      matched = matched.filter((lead) =>
        (lead.source ?? '').toLowerCase().includes(sourceQuery),
      );
    }

    if (filters.assignedTo) {
      matched = matched.filter(
        (lead) => lead.createdById === filters.assignedTo,
      );
    }

    if (filters.createdFrom) {
      const from = new Date(`${filters.createdFrom}T00:00:00`);
      matched = matched.filter((lead) => {
        if (!lead.createdAt) return false;
        const created = new Date(lead.createdAt);
        return !Number.isNaN(created.getTime()) && created >= from;
      });
    }

    if (filters.createdTo) {
      const to = new Date(`${filters.createdTo}T23:59:59.999`);
      matched = matched.filter((lead) => {
        if (!lead.createdAt) return false;
        const created = new Date(lead.createdAt);
        return !Number.isNaN(created.getTime()) && created <= to;
      });
    }

    if (
      typeof filters.staleDays === 'number' &&
      !Number.isNaN(filters.staleDays) &&
      filters.staleDays >= 0
    ) {
      const cutoff = Date.now() - filters.staleDays * 24 * 60 * 60 * 1000;
      matched = matched.filter((lead) => {
        if (!lead.updatedAt) return false;
        const updated = new Date(lead.updatedAt).getTime();
        return !Number.isNaN(updated) && updated < cutoff;
      });
    }

    return matched.sort((a, b) => {
      const byName = `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        'fr',
        { sensitivity: 'base' },
      );
      if (byName !== 0) return byName;
      return (a.companyName ?? '').localeCompare(b.companyName ?? '', 'fr', {
        sensitivity: 'base',
      });
    });
  }, [leads, query, searchFields, filters]);

  // Pagination : calcul des leads à afficher pour la page courante
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, leadsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / leadsPerPage));

  // Réinitialiser à la page 1 si la recherche, les filtres ou la taille de page change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, searchFields, leadsPerPage, filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const grouped = useMemo(() => {
    const map: Record<string, LeadRow[]> = {};
    for (const status of STATUS_ORDER) map[status] = [];
    for (const lead of filtered) {
      const key = STATUS_ORDER.includes(
        lead.status as (typeof STATUS_ORDER)[number],
      )
        ? lead.status
        : 'EN_PROSPECTION';
      map[key].push(lead);
    }
    return map;
  }, [filtered]);

  const handleLeadDrop = async (
    leadId: string,
    newStatus: string,
    fromStatus?: string,
  ) => {
    const row = leads.find((l) => l.id === leadId);
    if (!row) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
    );
    try {
      const res = await fetch(
        `/api/prospects/${row.prospectId}/contacts/${row.contactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ negotiationStage: newStatus }),
        },
      );
      if (!res.ok) throw new Error('Erreur');
    } catch {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: fromStatus ?? l.status } : l,
        ),
      );
    }
  };

  const contactHref = (lead: LeadRow) =>
    `/leads/${lead.prospectId}/contacts/${lead.contactId}`;

  // Ouvrir la fiche contact
  const openLead = (lead: LeadRow | Lead) => {
    const prospectId =
      'prospectId' in lead && lead.prospectId
        ? lead.prospectId
        : (lead as LeadRow).prospectId;
    const contactId =
      'contactId' in lead && lead.contactId
        ? lead.contactId
        : (lead as LeadRow).contactId;
    if (prospectId && contactId) {
      router.push(`/leads/${prospectId}/contacts/${contactId}`);
      return;
    }
    router.push(`/leads/${lead.id}`);
  };

  const toLeadCard = (lead: LeadRow): Lead => ({
    id: lead.id,
    prospectId: lead.prospectId,
    contactId: lead.contactId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    source: lead.source,
    notes: lead.notes,
    companyName: lead.companyName,
    jobTitle: lead.jobTitle,
    location: lead.location,
    geographicSituation: lead.geographicSituation,
    activityDomains: lead.activityDomains,
    activitySector: lead.activitySector,
    leadType: lead.leadType,
    civility: lead.civility,
    decisionRole: lead.decisionRole,
    crmCompanyName: lead.crmCompanyName,
    canViewFiche: lead.canViewFiche,
    ownerName: lead.ownerName,
  });

  // Export des leads
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (hasGroupScope && apiCompanyId)
        params.set('companyId', apiCompanyId);
      const res = await fetch(
        `/api/prospects/export${params.toString() ? `?${params.toString()}` : ''}`,
      );
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Export leads échoué');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `leads-${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Erreur lors de l'export des leads", error);
    } finally {
      setExporting(false);
    }
  };

  // Sélectionner une vue
  const handleSelectView = (id: string) => {
    if (!id || id === 'custom') return;
    setSelectedViewId(id);
    if (id.startsWith('system-')) {
      setFilters(buildSystemViewFilters(id));
      return;
    }
    const view = savedViews.find((v) => v.id === id);
    if (view) {
      setFilters({ ...DEFAULT_FILTERS, ...view.filters });
    }
  };

  const markCustomView = () => {
    setSelectedViewId('custom');
  };

  // Enregistrer la vue courante
  const handleSaveCurrentView = () => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Nom de la vue');
    if (!name) return;
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name,
      filters: { ...filters },
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    setSelectedViewId(newView.id);
    try {
      window.localStorage.setItem('crm_leads_views', JSON.stringify(updated));
    } catch {
      // silencieux
    }
  };

  // Toggle status filter
  const toggleStatusFilter = (status: string) => {
    markCustomView();
    setFilters((prev) => {
      const exists = prev.status.includes(status);
      return {
        ...prev,
        status: exists
          ? prev.status.filter((s) => s !== status)
          : [...prev.status, status],
      };
    });
  };

  const hasActiveFilters = useMemo(
    () =>
      filters.status.length > 0 ||
      filters.source.trim() !== '' ||
      filters.assignedTo !== '' ||
      filters.createdFrom !== '' ||
      filters.createdTo !== '' ||
      typeof filters.staleDays === 'number',
    [filters],
  );

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (filters.source.trim()) n += 1;
    if (filters.assignedTo) n += 1;
    if (filters.createdFrom || filters.createdTo) n += 1;
    if (typeof filters.staleDays === 'number') n += 1;
    return n;
  }, [filters]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((lead) => {
      const source = lead.source?.trim();
      if (source) set.add(source);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [leads]);

  const assignedToLabel =
    userOptions.find((u) => u.id === filters.assignedTo)?.name ?? '';

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedViewId('system-all');
  };

  const viewOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [
      ...SYSTEM_VIEW_OPTIONS.map((v) => ({ id: v.id, label: v.label })),
      ...savedViews.map((view) => ({ id: view.id, label: view.name })),
    ];
    if (selectedViewId === 'custom') {
      options.push({ id: 'custom', label: 'Vue personnalisée' });
    }
    return options;
  }, [savedViews, selectedViewId]);

  const selectedViewLabel =
    viewOptions.find((v) => v.id === selectedViewId)?.label ?? 'Choisir une vue';

  return (
    <>
      <section className='mt-2 flex flex-col gap-4'>
        <LeadsOnboardingCarousel
          onAddLead={() => {
            if (!isHoldingMode) setSheetOpen(true);
          }}
          onImport={() => {
            if (!isHoldingMode) setImportSheetOpen(true);
          }}
          onShowPipeline={() => setViewMode('kanban')}
        />

        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end'>
          <div
            className='flex shrink-0 self-start rounded-full bg-white p-0.5 shadow-neu'
            role='group'
            aria-label="Mode d'affichage"
          >
            {(['liste', 'kanban', 'grid'] as const).map((mode) => (
              <button
                key={mode}
                type='button'
                onClick={() => setViewMode(mode)}
                className={`rounded-full p-2 text-xs transition-colors ${
                  viewMode === mode
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                title={
                  mode === 'liste'
                    ? 'Liste'
                    : mode === 'kanban'
                      ? 'Kanban'
                      : 'Grille'
                }
                aria-label={
                  mode === 'liste'
                    ? 'Liste'
                    : mode === 'kanban'
                      ? 'Kanban'
                      : 'Grille'
                }
                aria-pressed={viewMode === mode}
              >
                {mode === 'liste' && <List className='h-4 w-4' />}
                {mode === 'kanban' && <Columns3 className='h-4 w-4' />}
                {mode === 'grid' && <LayoutGrid className='h-4 w-4' />}
              </button>
            ))}
          </div>
        </div>

        <div
          id='leads-actions'
          className='scroll-mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end'
          role='group'
          aria-label='Actions prospects'
        >
          <button
            type='button'
            onClick={() => setSheetOpen(true)}
            disabled={isHoldingMode}
            title={
              isHoldingMode
                ? 'Sélectionnez une filiale pour ajouter un lead'
                : undefined
            }
            className='col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-white shadow-neu transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:order-3 sm:col-span-1 sm:min-w-42'
          >
            <Plus className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>Ajouter un lead</span>
          </button>

          <button
            type='button'
            onClick={() => !isHoldingMode && setImportSheetOpen(true)}
            disabled={isHoldingMode}
            title={
              isHoldingMode
                ? 'Sélectionnez une filiale pour importer des leads'
                : 'Importer depuis Excel'
            }
            className='inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-neu transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-38'
          >
            <Upload className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>Importer</span>
            <span className='hidden md:inline truncate'>Excel</span>
          </button>

          <button
            type='button'
            onClick={() => void fetchLeads()}
            disabled={loading}
            title='Actualiser'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-neu transition hover:bg-gray-50 disabled:opacity-60 sm:min-w-38'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`}
            />
            <span className='truncate'>Actualiser</span>
          </button>

          <button
            type='button'
            onClick={handleExport}
            disabled={exporting}
            title='Exporter les leads'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 shadow-neu transition hover:bg-gray-50 disabled:opacity-60 sm:min-w-38'
          >
            <Download className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>
              {exporting ? 'Export…' : 'Exporter'}
            </span>
          </button>
        </div>
      </section>

      <NeumoCard
        id='leads-pipeline'
        className='mt-4 scroll-mt-4 p-4 bg-white flex flex-col gap-4'
      >
        <div className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <div className='min-w-0 flex-1'>
              <LeadSearchBar
                query={query}
                onQueryChange={setQuery}
                searchFields={searchFields}
                onSearchFieldsChange={setSearchFields}
              />
            </div>

            <button
              type='button'
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium ${
                showFilters || hasActiveFilters
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Filter className='h-3.5 w-3.5' />
              Filtre
              {hasActiveFilters
                ? ` (${
                    (filters.status.length > 0 ? 1 : 0) + advancedFilterCount
                  })`
                : ''}
            </button>

            {hasGroupScope && (
              <div className='w-36 shrink-0 sm:w-44 md:w-52'>
                <GroupCompanySelect
                  id='leads-company'
                  label=''
                  value={selectedCompanyId}
                  options={companyOptions}
                  fallbackOption={
                    authUser?.company
                      ? {
                          id: authUser.company.id,
                          name: authUser.company.name,
                        }
                      : undefined
                  }
                  includeHoldingOption
                  onChange={(companyId) => {
                    setSelectedViewId('system-all');
                    setSelectedCompanyId(companyId);
                    setFilters((prev) => ({ ...prev, assignedTo: '' }));
                  }}
                  selectClassName='h-9 w-full min-w-0 rounded-full border border-gray-200 bg-white px-3 text-[11px] text-gray-700'
                />
              </div>
            )}
          </div>

          {(showFilters || hasActiveFilters) && (
          <div className='flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-[#fafaff] p-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    className='inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-[11px] text-gray-600 outline-none hover:border-gray-300'
                  >
                    <span className='text-gray-400'>Vue</span>
                    <span className='max-w-44 truncate font-medium text-primary'>
                      {selectedViewLabel}
                    </span>
                    <ChevronDown className='h-3 w-3 shrink-0 text-gray-400' />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='w-64 space-y-1 p-2'>
                  <p className='px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                    Vues enregistrées
                  </p>
                  {viewOptions.map((opt) => {
                    const active = selectedViewId === opt.id;
                    const disabled = opt.id === 'custom';
                    return (
                      <PopoverClose key={opt.id} asChild>
                        <button
                          type='button'
                          disabled={disabled}
                          onClick={() => {
                            if (!disabled) handleSelectView(opt.id);
                          }}
                          className={`flex w-full items-center rounded-xl px-2.5 py-2 text-left text-[11px] transition-colors ${
                            disabled
                              ? 'cursor-default text-gray-400'
                              : active
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

              <div className='ml-auto flex flex-wrap items-center gap-1.5'>
                {hasActiveFilters && (
                  <button
                    type='button'
                    onClick={resetFilters}
                    className='inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-100 bg-white px-3 text-[11px] font-medium text-rose-600 hover:bg-rose-50'
                  >
                    <RotateCcw className='h-3 w-3' />
                    Réinitialiser
                  </button>
                )}
                <button
                  type='button'
                  onClick={handleSaveCurrentView}
                  className='inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600 hover:border-primary/30 hover:text-primary'
                >
                  <Save className='h-3 w-3' />
                  Enregistrer
                </button>
              </div>
            </div>

            <div className='flex flex-col gap-1.5 border-t border-gray-100/80 pt-2.5'>
              <span className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                Stade de négociation
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {STATUS_ORDER.map((status) => {
                  const active = filters.status.includes(status);
                  return (
                    <button
                      key={status}
                      type='button'
                      onClick={() => toggleStatusFilter(status)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        active
                          ? 'border-primary bg-primary text-white shadow-neu'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {STATUS_LABELS[status] ?? status}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className='flex flex-col gap-1.5 border-t border-gray-100/80 pt-2.5'>
              <span className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                Filtres avancés
                {advancedFilterCount > 0
                  ? ` · ${advancedFilterCount} actif${advancedFilterCount > 1 ? 's' : ''}`
                  : ''}
              </span>
              <div className='flex flex-wrap items-center gap-2'>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type='button' className='outline-none'>
                      <FilterChipButton
                        label='Source'
                        value={filters.source.trim() || undefined}
                        active={Boolean(filters.source.trim())}
                        onClear={() => {
                          markCustomView();
                          setFilters((prev) => ({ ...prev, source: '' }));
                        }}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className='w-56 space-y-2 p-3'>
                    <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                      Source
                    </p>
                    <input
                      type='text'
                      value={filters.source}
                      onChange={(e) => {
                        markCustomView();
                        setFilters((prev) => ({
                          ...prev,
                          source: e.target.value,
                        }));
                      }}
                      placeholder='Ex: Facebook, LinkedIn…'
                      list='leads-source-suggestions'
                      className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                    />
                    <datalist id='leads-source-suggestions'>
                      {availableSources.map((source) => (
                        <option key={source} value={source} />
                      ))}
                    </datalist>
                  </PopoverContent>
                </Popover>

                {isManagerOrAdmin && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type='button' className='outline-none'>
                        <FilterChipButton
                          label='Commercial'
                          value={assignedToLabel || undefined}
                          active={Boolean(filters.assignedTo)}
                          onClear={() => {
                            markCustomView();
                            setFilters((prev) => ({
                              ...prev,
                              assignedTo: '',
                            }));
                          }}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className='w-56 space-y-2 p-3'>
                      <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                        Commercial
                      </p>
                      <select
                        value={filters.assignedTo}
                        onChange={(e) => {
                          markCustomView();
                          setFilters((prev) => ({
                            ...prev,
                            assignedTo: e.target.value,
                          }));
                        }}
                        className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                      >
                        <option value=''>Tous</option>
                        {userOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </PopoverContent>
                  </Popover>
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <button type='button' className='outline-none'>
                      <FilterChipButton
                        label='Date de création'
                        value={
                          filters.createdFrom || filters.createdTo
                            ? `${filters.createdFrom ? formatFilterDate(filters.createdFrom) : '…'} → ${filters.createdTo ? formatFilterDate(filters.createdTo) : '…'}`
                            : undefined
                        }
                        active={Boolean(
                          filters.createdFrom || filters.createdTo,
                        )}
                        onClear={() => {
                          markCustomView();
                          setFilters((prev) => ({
                            ...prev,
                            createdFrom: '',
                            createdTo: '',
                          }));
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
                        value={filters.createdFrom}
                        max={filters.createdTo || undefined}
                        placeholder='Date de début'
                        onChange={(value) => {
                          markCustomView();
                          setFilters((prev) => ({
                            ...prev,
                            createdFrom: value,
                          }));
                        }}
                      />
                    </label>
                    <label className='flex flex-col gap-1'>
                      <span className='text-[10px] text-gray-500'>Au</span>
                      <DatePicker
                        value={filters.createdTo}
                        min={filters.createdFrom || undefined}
                        placeholder='Date de fin'
                        onChange={(value) => {
                          markCustomView();
                          setFilters((prev) => ({
                            ...prev,
                            createdTo: value,
                          }));
                        }}
                      />
                    </label>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <button type='button' className='outline-none'>
                      <FilterChipButton
                        label='Dernière activité'
                        value={
                          typeof filters.staleDays === 'number'
                            ? `> ${filters.staleDays} j`
                            : undefined
                        }
                        active={typeof filters.staleDays === 'number'}
                        onClear={() => {
                          markCustomView();
                          setFilters((prev) => ({
                            ...prev,
                            staleDays: undefined,
                          }));
                        }}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className='w-56 space-y-2 p-3'>
                    <p className='text-[10px] font-medium uppercase tracking-wide text-gray-400'>
                      Dernière activité &gt; X jours
                    </p>
                    <input
                      type='number'
                      min={0}
                      value={filters.staleDays ?? ''}
                      onChange={(e) => {
                        markCustomView();
                        const val = e.target.value;
                        const num = val ? Number.parseInt(val, 10) : NaN;
                        setFilters((prev) => ({
                          ...prev,
                          staleDays: Number.isNaN(num) ? undefined : num,
                        }));
                      }}
                      placeholder='Ex: 7'
                      className='h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] text-primary outline-none'
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          )}
        </div>

        {loading ? (
          <div className='mt-4 flex flex-col gap-4'>
            <SkeletonLoader className='h-20' />
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              <SkeletonLoader className='h-32' />
              <SkeletonLoader className='h-32' />
              <SkeletonLoader className='h-32' />
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'liste' && (
              <div className='flex flex-col gap-4'>
                <div className='mt-2'>
                  {filtered.length === 0 ? (
                    <div className='rounded-2xl border border-dashed border-gray-200 bg-white/50 px-4 py-10 text-center'>
                      <p className='text-[12px] text-gray-500'>
                        {hasActiveFilters || query.trim()
                          ? 'Aucun contact ne correspond à cette vue ou à ces filtres.'
                          : 'Aucun contact pour le moment. Ajoutez votre premier contact.'}
                      </p>
                    </div>
                  ) : (
                    <Table containerClassName='max-h-[min(70vh,720px)]'>
                      <TableHeader>
                        <TableRow className='hover:bg-transparent'>
                          <TableHead>Contact</TableHead>
                          <TableHead>Entreprise</TableHead>
                          {isHoldingMode && <TableHead>Société CRM</TableHead>}
                          <TableHead className='hidden md:table-cell'>
                            Poste
                          </TableHead>
                          <TableHead className='hidden lg:table-cell'>
                            Téléphone
                          </TableHead>
                          <TableHead>{NEGOTIATION_STAGE_FIELD_LABEL}</TableHead>
                          <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedLeads.map((lead) => {
                          const fullName =
                            `${lead.civility ? `${lead.civility} ` : ''}${lead.firstName} ${lead.lastName}`.trim() ||
                            'Contact';
                          const canOpen = lead.canViewFiche !== false;

                          return (
                            <TableRow
                              key={lead.id}
                              className={`group ${canOpen ? 'cursor-pointer' : 'opacity-70'}`}
                              onClick={() => {
                                if (canOpen) router.push(contactHref(lead));
                              }}
                            >
                              <TableCell>
                                <div className='flex items-center gap-2.5 min-w-0'>
                                  <div className='w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0 border border-primary/10'>
                                    {contactInitials(
                                      lead.firstName,
                                      lead.lastName,
                                    )}
                                  </div>
                                  <div className='min-w-0'>
                                    <p className='text-xs font-semibold text-primary truncate group-hover:underline'>
                                      {fullName}
                                    </p>
                                    {lead.email ? (
                                      <p className='text-[10px] text-gray-400 truncate'>
                                        {lead.email}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {lead.companyName?.trim() ? (
                                  <Link
                                    href={`/leads/${lead.prospectId}`}
                                    className='text-xs text-gray-700 hover:text-primary hover:underline'
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {lead.companyName}
                                  </Link>
                                ) : (
                                  <TableEmpty />
                                )}
                              </TableCell>
                              {isHoldingMode && (
                                <TableCell>
                                  {lead.crmCompanyName ? (
                                    <span className='truncate max-w-32 inline-block'>
                                      {lead.crmCompanyName}
                                    </span>
                                  ) : (
                                    <TableEmpty />
                                  )}
                                </TableCell>
                              )}
                              <TableCell className='hidden md:table-cell'>
                                {lead.jobTitle || <TableEmpty />}
                              </TableCell>
                              <TableCell className='hidden lg:table-cell'>
                                {lead.phone || <TableEmpty />}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${
                                    STATUS_STYLES[lead.status] ??
                                    'bg-gray-100 text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  {STATUS_LABELS[lead.status] ?? lead.status}
                                </span>
                              </TableCell>
                              <TableCell className='text-right'>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type='button'
                                      className='inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-500 hover:text-primary border border-gray-100 shadow-sm opacity-80 group-hover:opacity-100 transition'
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label='Actions'
                                    >
                                      <MoreHorizontal className='w-4 h-4' />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    side='bottom'
                                    align='end'
                                  >
                                    <DropdownMenuItem
                                      disabled={!canOpen}
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        if (canOpen)
                                          router.push(contactHref(lead));
                                      }}
                                    >
                                      <Eye className='w-4 h-4 mr-2' />
                                      Voir la fiche
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        router.push(
                                          `/leads/${lead.prospectId}`,
                                        );
                                      }}
                                    >
                                      <Pencil className='w-4 h-4 mr-2' />
                                      Voir l&apos;entreprise
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className='text-rose-600 focus:text-rose-600'
                                      onSelect={async (e) => {
                                        e.preventDefault();
                                        if (
                                          !confirm(
                                            'Mettre ce contact à la corbeille ?',
                                          )
                                        )
                                          return;
                                        try {
                                          const res = await fetch(
                                            `/api/prospects/${lead.prospectId}/contacts/${lead.contactId}`,
                                            { method: 'DELETE' },
                                          );
                                          if (res.ok) {
                                            setLeads((prev) =>
                                              prev.filter(
                                                (l) => l.id !== lead.id,
                                              ),
                                            );
                                          }
                                        } catch {
                                          // silencieux
                                        }
                                      }}
                                    >
                                      <Trash2 className='w-4 h-4 mr-2' />
                                      Mettre à la corbeille
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination */}
                {filtered.length > 0 && totalPages > 1 && (
                  <div className='flex items-center justify-between gap-4 pt-2 border-t border-gray-100'>
                    <div className='text-[11px] text-gray-500'>
                      Affichage de {(currentPage - 1) * leadsPerPage + 1} à{' '}
                      {Math.min(currentPage * leadsPerPage, filtered.length)}{' '}
                      sur {filtered.length} contacts
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                        title='Page précédente'
                      >
                        <ChevronLeft className='w-4 h-4' />
                      </button>
                      <div className='flex items-center gap-1'>
                        {Array.from(
                          { length: Math.min(totalPages, 7) },
                          (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 7) {
                              pageNum = i + 1;
                            } else if (currentPage <= 4) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                              pageNum = totalPages - 6 + i;
                            } else {
                              pageNum = currentPage - 3 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                type='button'
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-primary text-white shadow-neu'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          },
                        )}
                      </div>
                      <button
                        type='button'
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className='p-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                        title='Page suivante'
                      >
                        <ChevronRight className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'grid' && (
              <>
                <div className='grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:hidden'>
                  {filtered.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={toLeadCard(lead)}
                      compact
                      onClick={() => {
                        if (lead.canViewFiche !== false) openLead(lead);
                      }}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className='col-span-full py-4 text-[12px] text-gray-500'>
                      {hasActiveFilters || query.trim()
                        ? 'Aucun contact ne correspond à cette vue ou à ces filtres.'
                        : 'Aucun contact pour le moment. Ajoutez votre premier contact.'}
                    </p>
                  )}
                </div>

                <div className='hidden flex-col gap-4 lg:flex'>
                  <div className='grid grid-cols-3 items-start gap-4'>
                    {paginatedLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={toLeadCard(lead)}
                        compact
                        onClick={() => {
                          if (lead.canViewFiche !== false) openLead(lead);
                        }}
                      />
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <p className='py-4 text-[12px] text-gray-500'>
                      {hasActiveFilters || query.trim()
                        ? 'Aucun contact ne correspond à cette vue ou à ces filtres.'
                        : 'Aucun contact pour le moment. Ajoutez votre premier contact.'}
                    </p>
                  )}
                  {filtered.length > 0 && (
                    <div className='flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-2'>
                      <div className='flex flex-wrap items-center gap-3'>
                        <div className='text-[11px] text-gray-500'>
                          Affichage de {(currentPage - 1) * leadsPerPage + 1}{' '}
                          à{' '}
                          {Math.min(
                            currentPage * leadsPerPage,
                            filtered.length,
                          )}{' '}
                          sur {filtered.length} contacts
                        </div>
                        <label className='flex items-center gap-2 text-[11px] text-gray-500'>
                          <span>Par page</span>
                          <select
                            value={leadsPerPage}
                            onChange={(e) =>
                              setLeadsPerPage(Number(e.target.value))
                            }
                            className='h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700'
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {totalPages > 1 && (
                        <div className='flex items-center gap-2'>
                          <button
                            type='button'
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className='rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'
                            title='Page précédente'
                          >
                            <ChevronLeft className='h-4 w-4' />
                          </button>
                          <div className='flex items-center gap-1'>
                            {Array.from(
                              { length: Math.min(totalPages, 7) },
                              (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 7) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 4) {
                                  pageNum = i + 1;
                                } else if (currentPage >= totalPages - 3) {
                                  pageNum = totalPages - 6 + i;
                                } else {
                                  pageNum = currentPage - 3 + i;
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    type='button'
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      currentPage === pageNum
                                        ? 'bg-primary text-white shadow-neu'
                                        : 'border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              },
                            )}
                          </div>
                          <button
                            type='button'
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                            className='rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'
                            title='Page suivante'
                          >
                            <ChevronRight className='h-4 w-4' />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {viewMode === 'kanban' && (
              <div className='flex gap-4 overflow-x-auto pb-3 px-1 snap-x snap-mandatory'>
                {STATUS_ORDER.map((status) => (
                  <div key={status} className='snap-start'>
                    <PipelineColumn
                      title={STATUS_LABELS[status] ?? status}
                      status={status}
                      leads={(grouped[status] ?? []).map(toLeadCard)}
                      onDrop={handleLeadDrop}
                      onLeadClick={(l) => {
                        const row = leads.find((x) => x.id === l.id);
                        if (row && row.canViewFiche !== false) openLead(row);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </NeumoCard>

      <ProspectCreateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={() => {
          void fetchLeads();
        }}
      />

      <LeadImportSheet
        open={importSheetOpen}
        onClose={() => setImportSheetOpen(false)}
        companyId={
          hasGroupScope && apiCompanyId && !isHoldingMode
            ? apiCompanyId
            : undefined
        }
        onImported={() => fetchLeads()}
      />

      <LeadEditSheet
        open={editOpen}
        lead={selectedLead}
        onClose={() => setEditOpen(false)}
        onUpdated={(updated) => {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === updated.id
                ? {
                    ...l,
                    ...updated,
                    notes: updated.notes ?? undefined,
                  }
                : l,
            ),
          );
        }}
        onDeleted={(id) => {
          setLeads((prev) => prev.filter((l) => l.id !== id));
        }}
      />
    </>
  );
}

const LeadsPage = withDashboardLayout(LeadsPageInner, {
  title: 'Gestion Contacts',
  subtitle: 'Gérez vos contacts et suivez leurs stades de négociation.',
  titleIcon: ContactRound,
});

export default LeadsPage;
