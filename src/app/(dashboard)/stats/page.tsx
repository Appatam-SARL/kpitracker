'use client';

import GroupCompanySelect from '@/components/GroupCompanySelect';
import NeumoCard from '@/components/NeumoCard';
import { LeadDemographicsSection } from '@/components/stats/LeadDemographicsSection';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchApi } from '@/lib/fetch-api';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import { GROUP_HOLDING_SCOPE_VALUE } from '@/lib/group-scope-roles';
import { isAdminOrManagerLike } from '@/lib/roles';
import { Target, TrendingUp, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface GoalRow {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  targetConversions: number;
  targetRevenue: number;
  realizedConversions: number;
  realizedRevenue: number;
  user: { id: string; name: string; email: string };
}

interface CurrentGoalSummary {
  user: { id: string; name: string; email: string };
  periodLabel: string;
  targetConversions: number;
  realizedConversions: number;
  targetRevenue: number;
  realizedRevenue: number;
}

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

interface SalesSummaryReport {
  global: { nbLeadsTotal: number; nbClientsTotal: number; caTotal: number };
  byUser: Array<{
    userId: string;
    userName: string;
    nbLeads: number;
    nbClients: number;
    caTotal: number;
    conversionRate: number;
  }>;
  bySource: Array<{
    source: string | null;
    nbLeads: number;
    nbClients: number;
  }>;
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

function StatsPageInner() {
  const { user: authUser } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    scopeLabel,
    apiCompanyId,
  } = useGroupCompanyScope({ initialCompanyId: GROUP_HOLDING_SCOPE_VALUE });
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [currentGoalsByUser, setCurrentGoalsByUser] = useState<
    CurrentGoalSummary[]
  >([]);
  const [loadingCurrentGoals, setLoadingCurrentGoals] = useState(false);

  const defaultRange = getDefaultMonthRange();
  const [reportFrom, setReportFrom] = useState(defaultRange.from);
  const [reportTo, setReportTo] = useState(defaultRange.to);
  const [selectedCommercialId, setSelectedCommercialId] = useState('');
  const [reportSource, setReportSource] = useState('');
  const [report, setReport] = useState<SalesSummaryReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [commercialUsers, setCommercialUsers] = useState<UserOption[]>([]);

  const fetchGoals = useCallback(async (withLoading: boolean = false) => {
    try {
      if (withLoading) setLoading(true);
      const params = new URLSearchParams();
      if (hasGroupScope && apiCompanyId) {
        params.set('companyId', apiCompanyId);
      }
      if (selectedCommercialId.trim()) {
        params.set('userId', selectedCommercialId.trim());
      }
      const qs = params.toString();
      const url = qs ? `/api/goals?${qs}` : '/api/goals';
      const res = await fetchApi(url, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setGoals(data);
    } catch {
      // silencieux
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [hasGroupScope, apiCompanyId, selectedCommercialId]);

  // Objectifs (tableau + cartes) : même périmètre entreprise que le reste pour la directrice
  useEffect(() => {
    void fetchGoals(true);
  }, [fetchGoals]);

  // Chargement des objectifs "en cours" pour la vue manager/admin
  useEffect(() => {
    const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);
    if (!isManagerOrAdmin) return;

    const fetchCurrentGoals = async () => {
      try {
        setLoadingCurrentGoals(true);
        const params = new URLSearchParams();
        if (hasGroupScope && apiCompanyId) {
          params.set('companyId', apiCompanyId);
        }
        if (selectedCommercialId.trim()) {
          params.set('userId', selectedCommercialId.trim());
        }
        const q = params.toString();
        const res = await fetchApi(
          q ? `/api/goals/current?${q}` : '/api/goals/current',
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (selectedCommercialId.trim()) {
          setCurrentGoalsByUser(
            data && typeof data === 'object' && data.user ? [data] : [],
          );
        } else if (Array.isArray(data)) {
          setCurrentGoalsByUser(data);
        } else {
          setCurrentGoalsByUser([]);
        }
      } catch {
        // silencieux
      } finally {
        setLoadingCurrentGoals(false);
      }
    };

    void fetchCurrentGoals();
  }, [authUser?.role, hasGroupScope, apiCompanyId, selectedCommercialId]);

  // Rafraîchir les objectifs quand une conversion a eu lieu (événement global)
  useEffect(() => {
    const handler = () => {
      void fetchGoals(false);
    };
    window.addEventListener('crm:goals-invalidate', handler);
    return () => window.removeEventListener('crm:goals-invalidate', handler);
  }, [fetchGoals]);

  // Liste des commerciaux pour le filtre page (AGENT uniquement)
  useEffect(() => {
    const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);
    if (!isManagerOrAdmin) return;
    const fetchUsers = async () => {
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
          const mapped = data.map(
            (u: { id: string; name: string; email?: string }) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }),
          );
          setCommercialUsers(mapped);
        }
      } catch {
        // silencieux
      }
    };
    void fetchUsers();
  }, [authUser?.role, hasGroupScope, apiCompanyId]);

  useEffect(() => {
    if (
      selectedCommercialId &&
      commercialUsers.length > 0 &&
      !commercialUsers.some((u) => u.id === selectedCommercialId)
    ) {
      setSelectedCommercialId('');
    }
  }, [commercialUsers, selectedCommercialId]);

  const isManagerOrAdmin = isAdminOrManagerLike(authUser?.role);
  const isAgent = authUser?.role === 'agent';

  const commercialScopeLabel = useMemo(() => {
    const commercial = selectedCommercialId
      ? commercialUsers.find((u) => u.id === selectedCommercialId)?.name
      : undefined;
    if (commercial) {
      return `${scopeLabel} — ${commercial}`;
    }
    return scopeLabel;
  }, [selectedCommercialId, commercialUsers, scopeLabel]);
  const currentPeriodGoal =
    isAgent && goals.length > 0
      ? (goals.find((g) => {
          const end = new Date(g.periodEnd);
          const start = new Date(g.periodStart);
          const now = new Date();
          return now >= start && now <= end;
        }) ?? goals[0])
      : null;

  const handleRenew = async (goal: GoalRow) => {
    try {
      setRenewingId(goal.id);
      const res = await fetchApi(`/api/goals/${goal.id}/renew`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(
          (data && data.error) ||
            'Impossible de reconduire cet objectif. Veuillez réessayer.',
        );
        return;
      }
      await fetchGoals(false);
    } catch {
      window.alert(
        "Une erreur est survenue lors de la reconduction de l'objectif.",
      );
    } finally {
      setRenewingId(null);
    }
  };

  const handleGenerateReport = async () => {
    setReportError(null);
    if (!reportFrom.trim() || !reportTo.trim()) {
      setReportError('Veuillez renseigner les dates de début et de fin.');
      return;
    }
    try {
      setReportLoading(true);
      const params = new URLSearchParams({ from: reportFrom, to: reportTo });
      if (selectedCommercialId.trim()) {
        params.set('userId', selectedCommercialId);
      }
      if (reportSource.trim()) params.set('source', reportSource);
      if (hasGroupScope && apiCompanyId) {
        params.set('companyId', apiCompanyId);
      }
      const res = await fetchApi(
        `/api/reports/sales-summary?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReport(null);
        setReportError(
          typeof data?.error === 'string'
            ? data.error
            : 'Impossible de générer le rapport.',
        );
        return;
      }
      setReport(data);
    } catch {
      setReport(null);
      setReportError('Impossible de générer le rapport.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportReport = async () => {
    setReportError(null);
    if (!reportFrom.trim() || !reportTo.trim()) {
      setReportError('Veuillez renseigner les dates de début et de fin.');
      return;
    }
    const params = new URLSearchParams({ from: reportFrom, to: reportTo });
    if (selectedCommercialId.trim()) {
      params.set('userId', selectedCommercialId);
    }
    if (reportSource.trim()) params.set('source', reportSource);
    if (hasGroupScope && apiCompanyId) {
      params.set('companyId', apiCompanyId);
    }
    try {
      setExportLoading(true);
      const res = await fetchApi(
        `/api/reports/sales-summary/export?${params.toString()}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReportError(
          typeof data?.error === 'string'
            ? data.error
            : "Impossible de télécharger l'export.",
        );
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const name =
        match?.[1] ?? `tableau-bord-stats-${reportFrom}_${reportTo}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setReportError("Impossible de télécharger l'export.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <>
      <section className='mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-xl md:text-2xl font-semibold text-primary'>
            Statistiques
          </h1>
          <p className='text-xs md:text-sm text-gray-500'>
            Suivi des performances commerciales, taux de conversion et
            objectifs.
          </p>
        </div>
        {(hasGroupScope || isManagerOrAdmin) && (
          <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap'>
            {hasGroupScope && (
              <GroupCompanySelect
                id='stats-page-company'
                label='Entreprise (toute la page)'
                value={selectedCompanyId}
                options={companyOptions}
                includeHoldingOption
                fallbackOption={
                  authUser?.company
                    ? { id: authUser.company.id, name: authUser.company.name }
                    : undefined
                }
                onChange={(companyId) => {
                  setSelectedCompanyId(companyId);
                  setSelectedCommercialId('');
                  setReport(null);
                }}
              />
            )}
            {isManagerOrAdmin && (
              <div className='flex flex-col gap-1 min-w-[180px]'>
                <label
                  className='text-[11px] text-gray-500'
                  htmlFor='stats-page-commercial'
                >
                  Commercial (toute la page)
                </label>
                <select
                  id='stats-page-commercial'
                  value={selectedCommercialId}
                  onChange={(e) => {
                    setSelectedCommercialId(e.target.value);
                    setReport(null);
                  }}
                  className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs w-full sm:w-auto min-w-[180px]'
                >
                  <option value=''>Tous les commerciaux</option>
                  {commercialUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      {isManagerOrAdmin && (
        <LeadDemographicsSection
          companyId={apiCompanyId}
          userId={selectedCommercialId || undefined}
          scopeLabel={commercialScopeLabel}
        />
      )}

      {isManagerOrAdmin && (
        <section className='mt-4'>
          <NeumoCard className='p-5 bg-linear-to-br from-slate-50 via-white to-indigo-50/50 border border-gray-100 shadow-neu-soft flex flex-col gap-4'>
            <p className='text-xs font-semibold text-primary'>
              Rapports (MANAGER) — Résumé des ventes
            </p>
            <div className='flex flex-col sm:flex-row flex-wrap gap-3 items-end'>
              <div className='flex flex-col gap-1'>
                <label className='text-[11px] text-gray-500'>Du</label>
                <input
                  type='date'
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                />
              </div>
              <div className='flex flex-col gap-1'>
                <label className='text-[11px] text-gray-500'>Au</label>
                <input
                  type='date'
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs'
                />
              </div>
              <div className='flex flex-col gap-1'>
                <label className='text-[11px] text-gray-500'>
                  Source (optionnel)
                </label>
                <input
                  type='text'
                  value={reportSource}
                  onChange={(e) => setReportSource(e.target.value)}
                  placeholder='Ex: Site web'
                  className='rounded-lg border border-gray-200 px-2 py-1.5 text-xs min-w-[120px]'
                />
              </div>
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={handleGenerateReport}
                  disabled={reportLoading || exportLoading}
                  className='px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60'
                >
                  {reportLoading ? 'Génération…' : 'Générer le rapport'}
                </button>
                <button
                  type='button'
                  onClick={handleExportReport}
                  disabled={
                    exportLoading ||
                    reportLoading ||
                    !reportFrom.trim() ||
                    !reportTo.trim()
                  }
                  className='px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 disabled:opacity-60'
                >
                  {exportLoading ? 'Export…' : 'Exporter'}
                </button>
              </div>
            </div>
            {reportError && (
              <p className='text-[11px] text-red-600'>{reportError}</p>
            )}
            {report && (
              <>
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2'>
                  <div className='rounded-xl border border-gray-100 bg-white p-3'>
                    <span className='text-[11px] text-gray-500'>Leads</span>
                    <p className='text-lg font-semibold text-primary'>
                      {report.global.nbLeadsTotal}
                    </p>
                  </div>
                  <div className='rounded-xl border border-gray-100 bg-white p-3'>
                    <span className='text-[11px] text-gray-500'>Clients</span>
                    <p className='text-lg font-semibold text-primary'>
                      {report.global.nbClientsTotal}
                    </p>
                  </div>
                  <div className='rounded-xl border border-gray-100 bg-white p-3'>
                    <span className='text-[11px] text-gray-500'>CA</span>
                    <p className='text-lg font-semibold text-primary'>
                      {report.global.caTotal.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'XOF',
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>
                <div className='overflow-x-auto'>
                  <p className='text-[11px] font-medium text-gray-600 mb-2'>
                    Par commercial
                  </p>
                  <table className='min-w-full text-xs'>
                    <thead className='text-gray-500 border-b border-gray-100'>
                      <tr>
                        <th className='py-2 text-left font-medium'>
                          Commercial
                        </th>
                        <th className='py-2 text-right font-medium'>Leads</th>
                        <th className='py-2 text-right font-medium'>Clients</th>
                        <th className='py-2 text-right font-medium'>CA</th>
                        <th className='py-2 text-right font-medium'>
                          Taux conversion
                        </th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-700'>
                      {report.byUser.map((r) => (
                        <tr
                          key={r.userId}
                          className='border-b border-gray-50 hover:bg-gray-50/60'
                        >
                          <td className='py-2 font-medium'>{r.userName}</td>
                          <td className='py-2 text-right'>{r.nbLeads}</td>
                          <td className='py-2 text-right'>{r.nbClients}</td>
                          <td className='py-2 text-right'>
                            {r.caTotal.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'XOF',
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className='py-2 text-right'>
                            {r.conversionRate.toFixed(1)} %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='overflow-x-auto'>
                  <p className='text-[11px] font-medium text-gray-600 mb-2'>
                    Par source
                  </p>
                  <table className='min-w-full text-xs'>
                    <thead className='text-gray-500 border-b border-gray-100'>
                      <tr>
                        <th className='py-2 text-left font-medium'>Source</th>
                        <th className='py-2 text-right font-medium'>Leads</th>
                        <th className='py-2 text-right font-medium'>Clients</th>
                      </tr>
                    </thead>
                    <tbody className='text-gray-700'>
                      {report.bySource.map((r, i) => (
                        <tr
                          key={i}
                          className='border-b border-gray-50 hover:bg-gray-50/60'
                        >
                          <td className='py-2 font-medium'>
                            {r.source ?? 'Inconnu'}
                          </td>
                          <td className='py-2 text-right'>{r.nbLeads}</td>
                          <td className='py-2 text-right'>{r.nbClients}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </NeumoCard>
        </section>
      )}

      {isManagerOrAdmin && (
        <section className='mt-4'>
          <NeumoCard className='p-5 bg-linear-to-br from-violet-50 via-indigo-50/70 to-primary/5 border border-indigo-100 shadow-neu-soft flex flex-col gap-4'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-xs font-semibold text-primary'>
                Objectifs en cours par commercial
              </p>
              {loadingCurrentGoals && (
                <span className='text-[11px] text-gray-400'>Chargement…</span>
              )}
            </div>
            {currentGoalsByUser.length === 0 && !loadingCurrentGoals ? (
              <p className='text-[11px] text-gray-100'>
                Aucun objectif en cours pour cette période dans votre équipe.
              </p>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {currentGoalsByUser.map((g, idx) => {
                  const convRatio =
                    g.targetConversions > 0
                      ? g.realizedConversions / g.targetConversions
                      : 0;
                  const revRatio =
                    g.targetRevenue > 0
                      ? g.realizedRevenue / g.targetRevenue
                      : 0;
                  const convPct = Math.min(100, convRatio * 100);
                  const revPct = Math.min(100, revRatio * 100);

                  const ratioToColor = (ratio: number) => {
                    if (ratio >= 1) return 'bg-emerald-500';
                    if (ratio >= 0.5) return 'bg-amber-500';
                    return 'bg-rose-500';
                  };

                  const cardBg =
                    idx % 3 === 0
                      ? 'from-white/90 via-indigo-50/80 to-violet-50/90 border-indigo-100/70'
                      : idx % 3 === 1
                        ? 'from-white/90 via-emerald-50/80 to-teal-50/90 border-emerald-100/70'
                        : 'from-white/90 via-amber-50/80 to-orange-50/90 border-amber-100/70';

                  return (
                    <div
                      key={g.user.id}
                      className={`flex flex-col gap-3 text-[11px] rounded-2xl border shadow-neu-soft bg-linear-to-br ${cardBg} p-3`}
                    >
                      <div className='flex flex-col'>
                        <span className='font-semibold text-primary'>
                          {g.user.name}
                        </span>
                        <span className='text-gray-500'>{g.periodLabel}</span>
                      </div>
                      <div className='flex flex-col gap-1'>
                        <div className='flex justify-between'>
                          <span className='text-gray-500'>Conversions</span>
                          <span className='font-medium text-gray-700'>
                            {g.realizedConversions} / {g.targetConversions}
                          </span>
                        </div>
                        <div className='h-2.5 rounded-full bg-gray-200 overflow-hidden'>
                          <div
                            className={`h-full rounded-full ${ratioToColor(
                              convRatio,
                            )} transition-all`}
                            style={{ width: `${convPct}%` }}
                          />
                        </div>
                      </div>
                      <div className='flex flex-col gap-1'>
                        <div className='flex justify-between'>
                          <span className='text-gray-500'>CA</span>
                          <span className='font-medium text-gray-700'>
                            {g.realizedRevenue.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'XOF',
                              maximumFractionDigits: 0,
                            })}{' '}
                            /{' '}
                            {g.targetRevenue.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'XOF',
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        <div className='h-2.5 rounded-full bg-gray-200 overflow-hidden'>
                          <div
                            className={`h-full rounded-full ${ratioToColor(
                              revRatio,
                            )} transition-all`}
                            style={{ width: `${revPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </NeumoCard>
        </section>
      )}

      {isAgent && (
        <section className='mt-4'>
          {currentPeriodGoal ? (
            <NeumoCard className='p-5 bg-[#f5f5ff] border-2 border-primary/20'>
              <p className='text-xs font-semibold text-primary mb-3'>
                Mon objectif ({currentPeriodGoal.periodLabel})
              </p>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
                <div className='flex flex-col gap-2'>
                  <span className='text-gray-500'>Conversions</span>
                  <p className='font-semibold text-primary'>
                    {currentPeriodGoal.realizedConversions} /{' '}
                    {currentPeriodGoal.targetConversions}
                    {currentPeriodGoal.realizedConversions >=
                      currentPeriodGoal.targetConversions && (
                      <span className='text-emerald-600 ml-1'>✓</span>
                    )}
                  </p>
                  <div className='h-2 rounded-full bg-gray-200 overflow-hidden'>
                    <div
                      className='h-full rounded-full bg-primary transition-all'
                      style={{
                        width: `${
                          currentPeriodGoal.targetConversions > 0
                            ? Math.min(
                                100,
                                (currentPeriodGoal.realizedConversions /
                                  currentPeriodGoal.targetConversions) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <span className='text-gray-500'>CA</span>
                  <p className='font-semibold text-primary'>
                    {currentPeriodGoal.realizedRevenue.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XOF',
                      maximumFractionDigits: 0,
                    })}{' '}
                    /{' '}
                    {currentPeriodGoal.targetRevenue.toLocaleString('fr-FR', {
                      style: 'currency',
                      currency: 'XOF',
                      maximumFractionDigits: 0,
                    })}
                    {currentPeriodGoal.realizedRevenue >=
                      currentPeriodGoal.targetRevenue && (
                      <span className='text-emerald-600 ml-1'>✓</span>
                    )}
                  </p>
                  <div className='h-2 rounded-full bg-gray-200 overflow-hidden'>
                    <div
                      className='h-full rounded-full bg-primary transition-all'
                      style={{
                        width: `${
                          currentPeriodGoal.targetRevenue > 0
                            ? Math.min(
                                100,
                                (currentPeriodGoal.realizedRevenue /
                                  currentPeriodGoal.targetRevenue) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </NeumoCard>
          ) : goals.length > 0 ? (
            <NeumoCard className='p-5 bg-white'>
              <p className='text-xs font-semibold text-primary mb-2'>
                Mes objectifs
              </p>
              <p className='text-[11px] text-gray-500'>
                Aucun objectif pour la période en cours. Consultez le tableau
                ci-dessous pour l’historique.
              </p>
            </NeumoCard>
          ) : null}
        </section>
      )}

      {loading ? (
        <div className='mt-4 text-sm text-gray-500'>
          Chargement des objectifs…
        </div>
      ) : goals.length === 0 ? (
        <NeumoCard className='mt-4 p-5 bg-white'>
          <p className='text-sm text-gray-500'>
            Aucun objectif défini. Les managers et admins peuvent définir des
            objectifs depuis la page Utilisateurs (action « Définir objectif »
            sur un commercial).
          </p>
        </NeumoCard>
      ) : (
        <>
          <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <NeumoCard className='p-4 bg-linear-to-br from-primary/5 via-white to-indigo-50 flex flex-col gap-2 border border-primary/10 shadow-neu-soft'>
              <span className='text-[11px] text-gray-500 flex items-center gap-1'>
                <Target className='w-3.5 h-3.5' />
                Objectifs définis
              </span>
              <span className='text-2xl font-semibold text-primary'>
                {goals.length}
              </span>
              <span className='text-[11px] text-gray-400'>
                Périodes avec objectif conversions + CA
              </span>
            </NeumoCard>
            <NeumoCard className='p-4 bg-linear-to-br from-emerald-50 via-white to-teal-50 flex flex-col gap-2 border border-emerald-100 shadow-neu-soft'>
              <span className='text-[11px] text-gray-500 flex items-center gap-1'>
                <Users className='w-3.5 h-3.5' />
                Commerciaux concernés
              </span>
              <span className='text-2xl font-semibold text-primary'>
                {new Set(goals.map((g) => g.user.id)).size}
              </span>
              <span className='text-[11px] text-gray-400'>
                Avec au moins un objectif
              </span>
            </NeumoCard>
            <NeumoCard className='p-4 bg-linear-to-br from-amber-50 via-white to-orange-50 flex flex-col gap-2 border border-amber-100 shadow-neu-soft'>
              <span className='text-[11px] text-gray-500 flex items-center gap-1'>
                <TrendingUp className='w-3.5 h-3.5' />
                Conversions (total réalisé)
              </span>
              <span className='text-2xl font-semibold text-primary'>
                {goals.reduce((s, g) => s + g.realizedConversions, 0)}
              </span>
              <span className='text-[11px] text-gray-400'>
                Objectif total :{' '}
                {goals.reduce((s, g) => s + g.targetConversions, 0)}
              </span>
            </NeumoCard>
          </div>

          <NeumoCard className='mt-6 p-5 bg-linear-to-br from-[#f7f7fb] via-white to-indigo-50/40 flex flex-col gap-4 border border-gray-100 shadow-neu-soft'>
            <p className='text-xs font-semibold text-primary'>
              {isManagerOrAdmin
                ? 'Objectifs par commercial et par période'
                : 'Mes objectifs (toutes périodes)'}
            </p>
            <div className='overflow-x-auto'>
              <table className='min-w-full text-xs'>
                <thead className='text-gray-500 border-b border-gray-100'>
                  <tr>
                    {isManagerOrAdmin && (
                      <th className='py-2 text-left font-medium'>Commercial</th>
                    )}
                    <th className='py-2 text-left font-medium'>Période</th>
                    <th className='py-2 text-right font-medium'>
                      Conversions (réalisé / objectif)
                    </th>
                    <th className='py-2 text-right font-medium'>
                      CA (réalisé / objectif)
                    </th>
                    {isManagerOrAdmin && (
                      <th className='py-2 text-right font-medium'>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className='text-gray-700'>
                  {goals.map((g) => (
                    <tr
                      key={g.id}
                      className='border-b border-gray-50 hover:bg-gray-50/60'
                    >
                      {isManagerOrAdmin && (
                        <td className='py-2.5 font-medium'>{g.user.name}</td>
                      )}
                      <td className='py-2.5'>{g.periodLabel}</td>
                      <td className='py-2.5 text-right'>
                        <span
                          className={
                            g.realizedConversions >= g.targetConversions
                              ? 'text-emerald-600 font-medium'
                              : ''
                          }
                        >
                          {g.realizedConversions}
                        </span>
                        <span className='text-gray-400'> / </span>
                        <span>{g.targetConversions}</span>
                      </td>
                      <td className='py-2.5 text-right'>
                        <span
                          className={
                            g.realizedRevenue >= g.targetRevenue
                              ? 'text-emerald-600 font-medium'
                              : ''
                          }
                        >
                          {g.realizedRevenue.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'XOF',
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className='text-gray-400'> / </span>
                        <span>
                          {g.targetRevenue.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'XOF',
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </td>
                      {isManagerOrAdmin && (
                        <td className='py-2.5 text-right'>
                          {(() => {
                            const now = new Date();
                            const end = new Date(g.periodEnd);
                            const periodFinished = now > end;
                            const conversionsNotReached =
                              g.targetConversions > 0 &&
                              g.realizedConversions < g.targetConversions;
                            const revenueNotReached =
                              g.targetRevenue > 0 &&
                              g.realizedRevenue < g.targetRevenue;
                            const canRenew =
                              periodFinished &&
                              (conversionsNotReached || revenueNotReached);

                            if (!canRenew) return null;

                            return (
                              <button
                                type='button'
                                onClick={() => handleRenew(g)}
                                disabled={renewingId === g.id}
                                className='inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/15 disabled:opacity-50'
                              >
                                Reconduire
                              </button>
                            );
                          })()}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NeumoCard>
        </>
      )}
    </>
  );
}

const StatsPage = withDashboardLayout(StatsPageInner);

export default StatsPage;
