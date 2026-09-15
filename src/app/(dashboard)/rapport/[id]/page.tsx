'use client';

import NeumoCard from '@/components/NeumoCard';
import DashboardShell from '@/components/layouts/DashboardShell';
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
import { fetchApi } from '@/lib/fetch-api';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import { GROUP_HOLDING_SCOPE_VALUE } from '@/lib/group-scope-roles';
import { isAdminOrManagerLike } from '@/lib/roles';
import type { SalesSummaryReport } from '@/lib/sales-summary-report';
import {
  Archive,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileType2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type ReportDetail = {
  id: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  source: string | null;
  scopeLabel: string | null;
  payload: SalesSummaryReport;
  createdAt: string;
  archivedAt: string | null;
  agent: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
  company: { id: string; name: string };
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
}

function formatMoney(value: number): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  });
}

export default function RapportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { hasGroupScope, apiCompanyId, scopeLabel } = useGroupCompanyScope({
    initialCompanyId: GROUP_HOLDING_SCOPE_VALUE,
  });

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const canAccess = isAdminOrManagerLike(authUser?.role);
  const reportId = params?.id;

  const companyQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (hasGroupScope && apiCompanyId) q.set('companyId', apiCompanyId);
    return q.toString();
  }, [hasGroupScope, apiCompanyId]);

  const fetchDetail = useCallback(async () => {
    if (!reportId) return;
    try {
      setLoading(true);
      setError(null);
      const qs = companyQuery();
      const res = await fetchApi(
        qs
          ? `/api/reports/sales-reports/${reportId}?${qs}`
          : `/api/reports/sales-reports/${reportId}`,
        { cache: 'no-store' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReport(null);
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Impossible de charger le rapport.',
        );
        return;
      }
      setReport(data as ReportDetail);
    } catch {
      setReport(null);
      setError('Impossible de charger le rapport.');
    } finally {
      setLoading(false);
    }
  }, [reportId, companyQuery]);

  useEffect(() => {
    if (!canAccess) return;
    void fetchDetail();
  }, [canAccess, fetchDetail]);

  const handleArchive = async () => {
    if (!report || report.archivedAt) return;
    try {
      setArchiving(true);
      setError(null);
      const res = await fetchApi(`/api/reports/sales-reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived: true,
          companyId: hasGroupScope ? apiCompanyId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : "Impossible d'archiver le rapport.",
        );
        return;
      }
      setReport(data as ReportDetail);
    } catch {
      setError("Impossible d'archiver le rapport.");
    } finally {
      setArchiving(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'xlsx' | 'docx') => {
    if (!report) return;
    try {
      setDownloading(format);
      setError(null);
      const params = new URLSearchParams({ format });
      if (hasGroupScope && apiCompanyId) params.set('companyId', apiCompanyId);
      const res = await fetchApi(
        `/api/reports/sales-reports/${report.id}/download?${params.toString()}`,
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
      setDownloading(null);
    }
  };

  if (!canAccess) {
    return (
      <DashboardShell title='Détail rapport' subtitle='Accès restreint'>
        <NeumoCard className='border border-gray-100 bg-white p-5 shadow-neu-soft'>
          <p className='text-sm text-gray-600'>Accès réservé.</p>
          <Link
            href='/rapport'
            className='mt-3 inline-block text-[11px] font-medium text-primary hover:underline'
          >
            Retour aux rapports
          </Link>
        </NeumoCard>
      </DashboardShell>
    );
  }

  if (loading) {
    return (
      <DashboardShell title='Détail rapport' subtitle='Chargement…'>
        <p className='text-xs text-gray-500'>Chargement du rapport…</p>
      </DashboardShell>
    );
  }

  if (!report) {
    return (
      <DashboardShell title='Détail rapport' subtitle={scopeLabel}>
        <NeumoCard className='border border-gray-100 bg-white p-5 shadow-neu-soft'>
          <p className='text-sm text-gray-600'>
            {error ?? 'Rapport introuvable.'}
          </p>
          <button
            type='button'
            onClick={() => router.push('/rapport')}
            className='mt-3 text-[11px] font-medium text-primary hover:underline'
          >
            Retour à la liste
          </button>
        </NeumoCard>
      </DashboardShell>
    );
  }

  const payload = report.payload;

  return (
    <DashboardShell
      title='Détail rapport'
      subtitle={report.archivedAt ? 'Rapport archivé' : 'Rapport actif'}
    >
      <section className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Link
            href='/rapport'
            className='inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 hover:text-primary'
          >
            <ArrowLeft className='h-3.5 w-3.5' />
            Retour aux rapports
          </Link>
          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              title='PDF'
              disabled={downloading === 'pdf'}
              onClick={() => void handleDownload('pdf')}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:border-primary/30 hover:text-primary disabled:opacity-50'
            >
              <FileType2 className='h-3.5 w-3.5' />
              PDF
            </button>
            <button
              type='button'
              title='Excel'
              disabled={downloading === 'xlsx'}
              onClick={() => void handleDownload('xlsx')}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:border-primary/30 hover:text-primary disabled:opacity-50'
            >
              <FileSpreadsheet className='h-3.5 w-3.5' />
              Excel
            </button>
            <button
              type='button'
              title='Word'
              disabled={downloading === 'docx'}
              onClick={() => void handleDownload('docx')}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:border-primary/30 hover:text-primary disabled:opacity-50'
            >
              <Download className='h-3.5 w-3.5' />
              Word
            </button>
            {!report.archivedAt && (
              <button
                type='button'
                disabled={archiving}
                onClick={() => void handleArchive()}
                className='inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-white shadow-neu hover:brightness-105 disabled:opacity-60'
              >
                <Archive className='h-3.5 w-3.5' />
                {archiving ? '…' : 'Archiver'}
              </button>
            )}
          </div>
        </div>

        {error && <p className='text-[11px] text-red-600'>{error}</p>}

        <NeumoCard className='border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft flex flex-col gap-3'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div className='min-w-0'>
              <h2 className='text-base font-semibold text-gray-900'>
                {report.title}
              </h2>
              <p className='mt-1 text-[11px] text-gray-500'>
                Période {formatDate(report.periodFrom)} →{' '}
                {formatDate(report.periodTo)}
                {report.scopeLabel ? ` · ${report.scopeLabel}` : ''}
              </p>
            </div>
            {report.archivedAt && (
              <span className='rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-800'>
                Archivé le {formatDate(report.archivedAt)}
              </span>
            )}
          </div>
          <div className='grid grid-cols-1 gap-2 text-[11px] text-gray-600 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <span className='text-gray-400'>Commerciale</span>
              <p className='font-medium text-gray-800'>
                {report.agent?.name ?? 'Toutes'}
              </p>
            </div>
            <div>
              <span className='text-gray-400'>Source</span>
              <p className='font-medium text-gray-800'>
                {report.source ?? 'Toutes'}
              </p>
            </div>
            <div>
              <span className='text-gray-400'>Créé par</span>
              <p className='font-medium text-gray-800'>
                {report.createdBy.name}
              </p>
            </div>
            <div>
              <span className='text-gray-400'>Date de génération</span>
              <p className='font-medium text-gray-800'>
                {formatDate(report.createdAt)}
              </p>
            </div>
          </div>
        </NeumoCard>

        {payload?.cockpit && (
          <>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <NeumoCard className='border border-sky-100 bg-sky-600 p-4 text-white shadow-neu-soft'>
                <p className='text-[11px] font-semibold uppercase tracking-wide'>
                  OBJ CA
                </p>
                <p className='mt-1 text-lg font-semibold tabular-nums'>
                  {formatMoney(payload.cockpit.objectiveRevenue)}
                </p>
              </NeumoCard>
              <NeumoCard className='border border-gray-100 bg-gray-50 p-4 shadow-neu-soft'>
                <p className='text-[11px] font-semibold uppercase tracking-wide text-gray-500'>
                  Total CA réalisé
                </p>
                <p className='mt-1 text-lg font-semibold tabular-nums text-primary'>
                  {formatMoney(payload.cockpit.realizedRevenue)}
                </p>
              </NeumoCard>
              <NeumoCard
                className={`p-4 text-white shadow-neu-soft ${
                  payload.cockpit.remainder < 0 ? 'bg-red-700' : 'bg-emerald-700'
                }`}
              >
                <p className='text-[11px] font-semibold uppercase tracking-wide'>
                  Reste
                </p>
                <p className='mt-1 text-lg font-semibold tabular-nums'>
                  {formatMoney(payload.cockpit.remainder)}
                </p>
              </NeumoCard>
              <NeumoCard
                className={`p-4 text-white shadow-neu-soft ${
                  payload.cockpit.concludedSalesCount === 0
                    ? 'bg-red-800'
                    : 'bg-emerald-800'
                }`}
              >
                <p className='text-[11px] font-semibold uppercase tracking-wide'>
                  Ventes conclues
                </p>
                <p className='mt-1 text-lg font-semibold tabular-nums'>
                  {payload.cockpit.concludedSalesCount}
                </p>
              </NeumoCard>
            </div>

            <NeumoCard className='border border-gray-100 bg-white p-4 text-[11px] text-gray-600 shadow-neu-soft sm:p-5'>
              <div className='flex flex-wrap gap-x-6 gap-y-1'>
                <span>
                  Statut négociation :{' '}
                  <strong>{payload.cockpit.negotiationFilter}</strong>
                </span>
                <span>
                  Conclu le : <strong>{payload.cockpit.concludedOnLabel}</strong>
                </span>
                <span>
                  Taux d’atteinte :{' '}
                  <strong>{payload.cockpit.attainmentRate.toFixed(1)} %</strong>
                </span>
                <span>
                  Pipeline offres :{' '}
                  <strong>{formatMoney(payload.cockpit.pipelineAmount)}</strong>
                </span>
              </div>
              <p className='mt-2 text-gray-500'>
                {payload.cockpit.remainder < 0
                  ? `Objectif non atteint : ${formatMoney(Math.abs(payload.cockpit.remainder))} encore à réaliser.`
                  : payload.cockpit.objectiveRevenue > 0
                    ? 'Objectif de CA atteint ou dépassé sur la période.'
                    : 'Aucun objectif CA renseigné pour cette période.'}
              </p>
            </NeumoCard>

            <NeumoCard className='border border-gray-100 bg-white p-4 shadow-neu-soft sm:p-5'>
              <h3 className='mb-3 text-sm font-semibold text-gray-800'>
                Détail par entreprise
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Prestations proposées</TableHead>
                    <TableHead>Commerciale</TableHead>
                    <TableHead>Stade</TableHead>
                    <TableHead className='text-right'>Montant offres</TableHead>
                    <TableHead className='text-right'>CA réalisé</TableHead>
                    <TableHead className='text-right'>Nbre vente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.cockpit.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='text-center text-gray-400'>
                        Aucune offre ni vente sur cette période.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payload.cockpit.lines.map((line) => (
                      <TableRow key={`${line.prospectName}-${line.commercialName}`}>
                        <TableCell className='font-medium text-primary'>
                          {line.prospectName}
                        </TableCell>
                        <TableCell>{line.prestations}</TableCell>
                        <TableCell>{line.commercialName}</TableCell>
                        <TableCell>{line.stageLabel}</TableCell>
                        <TableCell className='text-right tabular-nums'>
                          {formatMoney(line.offerAmount)}
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>
                          {formatMoney(line.realizedAmount)}
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>
                          {line.salesCount}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </NeumoCard>
          </>
        )}

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <NeumoCard className='border border-gray-100 bg-white p-4 shadow-neu-soft'>
            <p className='text-[11px] text-gray-500'>Leads</p>
            <p className='text-xl font-semibold tabular-nums text-primary'>
              {payload?.global?.nbLeadsTotal ?? 0}
            </p>
          </NeumoCard>
          <NeumoCard className='border border-gray-100 bg-white p-4 shadow-neu-soft'>
            <p className='text-[11px] text-gray-500'>Clients convertis</p>
            <p className='text-xl font-semibold tabular-nums text-primary'>
              {payload?.global?.nbClientsTotal ?? 0}
            </p>
          </NeumoCard>
          <NeumoCard className='border border-gray-100 bg-white p-4 shadow-neu-soft'>
            <p className='text-[11px] text-gray-500'>CA</p>
            <p className='text-xl font-semibold tabular-nums text-primary'>
              {formatMoney(payload?.global?.caTotal ?? 0)}
            </p>
          </NeumoCard>
        </div>

        <NeumoCard className='border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft'>
          <h3 className='mb-3 text-sm font-semibold text-gray-800'>
            Par commerciale
          </h3>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Commerciale</TableHead>
                <TableHead className='text-right'>Leads</TableHead>
                <TableHead className='text-right'>Clients</TableHead>
                <TableHead className='text-right'>CA</TableHead>
                <TableHead className='text-right'>Taux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payload?.byUser?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-gray-400'>
                    Aucune donnée.
                  </TableCell>
                </TableRow>
              ) : (
                payload.byUser.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className='font-medium text-primary'>
                      {row.userName}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbLeads}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbClients}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {formatMoney(row.caTotal)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.conversionRate.toFixed(1)} %
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </NeumoCard>

        <NeumoCard className='border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft'>
          <h3 className='mb-3 text-sm font-semibold text-gray-800'>
            Par source
          </h3>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Source</TableHead>
                <TableHead className='text-right'>Leads</TableHead>
                <TableHead className='text-right'>Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payload?.bySource?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className='text-center text-gray-400'>
                    Aucune donnée.
                  </TableCell>
                </TableRow>
              ) : (
                payload.bySource.map((row, i) => (
                  <TableRow key={`${row.source ?? 'null'}-${i}`}>
                    <TableCell className='font-medium'>
                      {row.source ?? <TableEmpty />}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbLeads}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbClients}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </NeumoCard>

        {(payload?.byCompany?.length ?? 0) > 0 && (
          <NeumoCard className='border border-gray-100 bg-white p-4 sm:p-5 shadow-neu-soft'>
            <h3 className='mb-3 text-sm font-semibold text-gray-800'>
              Par filiale
            </h3>
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead>Filiale</TableHead>
                  <TableHead className='text-right'>Prospects</TableHead>
                  <TableHead className='text-right'>Leads</TableHead>
                  <TableHead className='text-right'>Clients</TableHead>
                  <TableHead className='text-right'>CA</TableHead>
                  <TableHead className='text-right'>Taux</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.byCompany.map((row) => (
                  <TableRow key={row.companyId}>
                    <TableCell className='font-medium text-primary'>
                      {row.companyName}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbProspectsTotal}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbLeads}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.nbClients}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {formatMoney(row.caTotal)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {row.conversionRate.toFixed(1)} %
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </NeumoCard>
        )}
      </section>
    </DashboardShell>
  );
}
