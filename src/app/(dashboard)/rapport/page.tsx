'use client';

import RapportOnboardingCarousel from '@/components/rapport/RapportOnboardingCarousel';
import GroupCompanySelect from '@/components/GroupCompanySelect';
import NeumoCard from '@/components/NeumoCard';
import DashboardShell from '@/components/layouts/DashboardShell';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DEFAULT_LEAD_SOURCES } from '@/config/lead-options';
import { fetchApi } from '@/lib/fetch-api';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import { GROUP_HOLDING_SCOPE_VALUE } from '@/lib/group-scope-roles';
import { isAdminOrManagerLike } from '@/lib/roles';
import {
  Archive,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileType2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CommercialOption = { id: string; name: string };

type SalesReportRow = {
  id: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  source: string | null;
  scopeLabel: string | null;
  createdAt: string;
  archivedAt: string | null;
  agent: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  company: { id: string; name: string };
};

function getDefaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, now.getMonth() + 1, 0);
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(last.getDate()).padStart(2, '0')}`,
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
}

export default function RapportPage() {
  const { user: authUser } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    scopeLabel,
    apiCompanyId,
  } = useGroupCompanyScope({ initialCompanyId: GROUP_HOLDING_SCOPE_VALUE });

  const defaultRange = getDefaultMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [agentId, setAgentId] = useState('');
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [reports, setReports] = useState<SalesReportRow[]>([]);
  const [listMode, setListMode] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = isAdminOrManagerLike(authUser?.role);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (hasGroupScope && apiCompanyId) params.set('companyId', apiCompanyId);
    if (listMode === 'archived') params.set('archived', '1');
    const qs = params.toString();
    return qs
      ? `/api/reports/sales-reports?${qs}`
      : '/api/reports/sales-reports';
  }, [hasGroupScope, apiCompanyId, listMode]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi(listUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) {
        setReports([]);
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Impossible de charger les rapports.',
        );
        return;
      }
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
      setError('Impossible de charger les rapports.');
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    if (!canAccess) return;
    void fetchReports();
  }, [canAccess, fetchReports]);

  useEffect(() => {
    if (!canAccess) return;
    const loadCommercials = async () => {
      try {
        const params = new URLSearchParams({ role: 'AGENT' });
        if (hasGroupScope && apiCompanyId) {
          params.set('companyId', apiCompanyId);
        }
        const res = await fetchApi(`/api/users?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setCommercials(
            data.map((u: { id: string; name: string }) => ({
              id: u.id,
              name: u.name,
            })),
          );
        }
      } catch {
        // silencieux
      }
    };
    void loadCommercials();
  }, [canAccess, hasGroupScope, apiCompanyId]);

  useEffect(() => {
    if (agentId && !commercials.some((c) => c.id === agentId)) {
      setAgentId('');
    }
  }, [commercials, agentId]);

  const handleGenerate = async () => {
    setError(null);
    if (!from.trim() || !to.trim()) {
      setError('Veuillez renseigner la période.');
      return;
    }
    try {
      setGenerating(true);
      const res = await fetchApi('/api/reports/sales-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          userId: agentId || undefined,
          source: source || undefined,
          companyId: hasGroupScope ? apiCompanyId : undefined,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Impossible de générer le rapport.',
        );
        return;
      }
      setTitle('');
      await fetchReports();
    } catch {
      setError('Impossible de générer le rapport.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (
    reportId: string,
    format: 'pdf' | 'xlsx' | 'docx',
  ) => {
    setError(null);
    try {
      setDownloadingId(`${reportId}-${format}`);
      const params = new URLSearchParams({ format });
      if (hasGroupScope && apiCompanyId) {
        params.set('companyId', apiCompanyId);
      }
      const res = await fetchApi(
        `/api/reports/sales-reports/${reportId}/download?${params.toString()}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Téléchargement impossible.',
        );
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const name = match?.[1] ?? `rapport.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Téléchargement impossible.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleArchive = async (reportId: string) => {
    setError(null);
    try {
      setArchivingId(reportId);
      const res = await fetchApi(`/api/reports/sales-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived: true,
          companyId: hasGroupScope ? apiCompanyId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === 'string'
            ? data.error
            : "Impossible d'archiver le rapport.",
        );
        return;
      }
      await fetchReports();
    } catch {
      setError("Impossible d'archiver le rapport.");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Supprimer ce rapport enregistré ?')) return;
    setError(null);
    try {
      setDeletingId(reportId);
      const params = new URLSearchParams();
      if (hasGroupScope && apiCompanyId) {
        params.set('companyId', apiCompanyId);
      }
      const qs = params.toString();
      const res = await fetchApi(
        qs
          ? `/api/reports/sales-reports/${reportId}?${qs}`
          : `/api/reports/sales-reports/${reportId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Suppression impossible.',
        );
        return;
      }
      await fetchReports();
    } catch {
      setError('Suppression impossible.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!canAccess) {
    return (
      <DashboardShell title='Rapport' subtitle='Accès restreint' titleIcon={FileText}>
        <NeumoCard className='border border-gray-100 bg-white p-5 shadow-neu-soft'>
          <p className='text-sm text-gray-600'>
            Cette page est réservée aux managers, administrateurs et rôles
            groupe.
          </p>
          <Link
            href='/'
            className='mt-3 inline-block text-[11px] font-medium text-primary hover:underline'
          >
            Retour au dashboard
          </Link>
        </NeumoCard>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title='Rapport'
      subtitle={`Synthèses de ventes par commerciale — ${scopeLabel}`}
      titleIcon={FileText}
    >
      <section className='flex flex-col gap-4'>
        <RapportOnboardingCarousel
          onShowArchived={() => setListMode('archived')}
        />

        <NeumoCard
          id='rapport-generer'
          className='scroll-mt-4 border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft flex flex-col gap-4'
        >
          <div>
            <h2 className='text-sm font-semibold text-gray-800'>
              Générer une synthèse
            </h2>
            <p className='mt-0.5 text-[11px] text-gray-500'>
              Le rapport est enregistré puis téléchargeable en PDF, Excel ou
              Word.
            </p>
          </div>

          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {hasGroupScope && (
              <GroupCompanySelect
                id='rapport-company'
                label='Entreprise'
                value={selectedCompanyId}
                options={companyOptions}
                includeHoldingOption
                fallbackOption={
                  authUser?.company
                    ? { id: authUser.company.id, name: authUser.company.name }
                    : undefined
                }
                onChange={(id) => {
                  setSelectedCompanyId(id);
                  setAgentId('');
                }}
              />
            )}
            <div className='flex flex-col gap-1'>
              <label className='text-[11px] text-gray-500' htmlFor='rapport-from'>
                Du
              </label>
              <DatePicker
                id='rapport-from'
                value={from}
                onChange={setFrom}
                max={to || undefined}
                placeholder='Date de début'
                buttonClassName='rounded-lg text-xs'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label className='text-[11px] text-gray-500' htmlFor='rapport-to'>
                Au
              </label>
              <DatePicker
                id='rapport-to'
                value={to}
                onChange={setTo}
                min={from || undefined}
                placeholder='Date de fin'
                buttonClassName='rounded-lg text-xs'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                className='text-[11px] text-gray-500'
                htmlFor='rapport-agent'
                id='rapport-agent-label'
              >
                Commerciale
              </label>
              <Select
                value={agentId || '__all__'}
                onValueChange={(value) =>
                  setAgentId(value === '__all__' ? '' : value)
                }
              >
                <SelectTrigger
                  id='rapport-agent'
                  aria-labelledby='rapport-agent-label'
                >
                  <SelectValue placeholder='Toutes les commerciales' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Toutes les commerciales</SelectItem>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-col gap-1'>
              <label
                className='text-[11px] text-gray-500'
                htmlFor='rapport-source'
                id='rapport-source-label'
              >
                Source (optionnel)
              </label>
              <Select
                value={source || '__all__'}
                onValueChange={(value) =>
                  setSource(value === '__all__' ? '' : value)
                }
              >
                <SelectTrigger
                  id='rapport-source'
                  aria-labelledby='rapport-source-label'
                >
                  <SelectValue placeholder='Toutes les sources' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Toutes les sources</SelectItem>
                  {DEFAULT_LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-col gap-1 sm:col-span-2 lg:col-span-1'>
              <label
                className='text-[11px] text-gray-500'
                htmlFor='rapport-title'
              >
                Titre (optionnel)
              </label>
              <input
                id='rapport-title'
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Ex. Bilan mensuel Appatam'
                className='rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs'
              />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={() => void handleGenerate()}
              disabled={generating}
              className='inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white shadow-neu hover:brightness-105 disabled:opacity-60'
            >
              <FileText className='h-3.5 w-3.5' />
              {generating ? 'Génération…' : 'Générer et enregistrer'}
            </button>
          </div>

          {error && <p className='text-[11px] text-red-600'>{error}</p>}
        </NeumoCard>

        <NeumoCard
          id='rapport-liste'
          className='scroll-mt-4 border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft'
        >
          <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-sm font-semibold text-gray-800'>
                Rapports enregistrés
              </h2>
              <p className='text-[11px] text-gray-500'>
                Consultez le détail, archivez ou téléchargez les synthèses
              </p>
            </div>
            <div className='flex rounded-full border border-gray-200 bg-bgGray/50 p-0.5'>
              <button
                type='button'
                onClick={() => setListMode('active')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  listMode === 'active'
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-600 hover:text-primary'
                }`}
              >
                Actifs
              </button>
              <button
                type='button'
                onClick={() => setListMode('archived')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  listMode === 'archived'
                    ? 'bg-primary text-white shadow-neu'
                    : 'text-gray-600 hover:text-primary'
                }`}
              >
                Archivés
              </button>
            </div>
          </div>

          {loading ? (
            <p className='text-xs text-gray-500'>Chargement…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead>Titre</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Commerciale</TableHead>
                  <TableHead>Créé par</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className='text-right'>Télécharger</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className='text-center text-gray-400'>
                      {listMode === 'archived'
                        ? 'Aucun rapport archivé.'
                        : 'Aucun rapport enregistré pour le moment.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className='max-w-[200px]'>
                        <Link
                          href={`/rapport/${report.id}`}
                          className='font-medium text-primary hover:underline'
                        >
                          {report.title}
                        </Link>
                        {report.scopeLabel && (
                          <span className='mt-0.5 block truncate text-[10px] text-gray-400'>
                            {report.scopeLabel}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='tabular-nums text-gray-600'>
                        {formatDate(report.periodFrom)} →{' '}
                        {formatDate(report.periodTo)}
                      </TableCell>
                      <TableCell>
                        {report.agent?.name ?? <TableEmpty />}
                      </TableCell>
                      <TableCell>{report.createdBy.name}</TableCell>
                      <TableCell className='tabular-nums text-gray-600'>
                        {formatDate(report.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          <button
                            type='button'
                            title='PDF'
                            disabled={downloadingId === `${report.id}-pdf`}
                            onClick={() =>
                              void handleDownload(report.id, 'pdf')
                            }
                            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary disabled:opacity-50'
                          >
                            <FileType2 className='h-3.5 w-3.5' />
                          </button>
                          <button
                            type='button'
                            title='Excel'
                            disabled={downloadingId === `${report.id}-xlsx`}
                            onClick={() =>
                              void handleDownload(report.id, 'xlsx')
                            }
                            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary disabled:opacity-50'
                          >
                            <FileSpreadsheet className='h-3.5 w-3.5' />
                          </button>
                          <button
                            type='button'
                            title='Word'
                            disabled={downloadingId === `${report.id}-docx`}
                            onClick={() =>
                              void handleDownload(report.id, 'docx')
                            }
                            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary disabled:opacity-50'
                          >
                            <Download className='h-3.5 w-3.5' />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          <Link
                            href={`/rapport/${report.id}`}
                            title='Voir le détail'
                            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary'
                          >
                            <Eye className='h-3.5 w-3.5' />
                          </Link>
                          {listMode !== 'archived' && (
                            <button
                              type='button'
                              title='Archiver'
                              disabled={archivingId === report.id}
                              onClick={() => void handleArchive(report.id)}
                              className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-primary/30 hover:text-primary disabled:opacity-50'
                            >
                              <Archive className='h-3.5 w-3.5' />
                            </button>
                          )}
                          {listMode !== 'archived' && (
                            <button
                              type='button'
                              title='Supprimer définitivement'
                              disabled={deletingId === report.id}
                              onClick={() => void handleDelete(report.id)}
                              className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-rose-500 hover:bg-rose-50 disabled:opacity-50'
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </NeumoCard>
      </section>
    </DashboardShell>
  );
}
