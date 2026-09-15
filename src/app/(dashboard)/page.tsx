"use client";

import GroupCompanySelect from "@/components/GroupCompanySelect";
import { useAuth } from "@/contexts/AuthContext";
import DashboardOnboardingCarousel from "@/components/dashboard/DashboardOnboardingCarousel";
import DashboardAgendaToday from "@/components/dashboard/DashboardAgendaToday";
import DashboardShell from "@/components/layouts/DashboardShell";
import NeumoCard from "@/components/NeumoCard";
import SkeletonLoader from "@/components/SkeletonLoader";
import {
  ChartPieDonut,
  ChartPieDonutBySource,
} from "@/components/ui/chart-pie-donut";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGroupCompanyScope } from "@/hooks/useGroupCompanyScope";
import {
  NEGOTIATION_STAGE_FIELD_LABEL,
  NEGOTIATION_STAGE_LABELS,
  NEGOTIATION_STAGE_STYLES,
} from "@/config/negotiation-stage";
import { GOALS_INVALIDATE_EVENT } from "@/lib/goals-events";
import { GROUP_HOLDING_SCOPE_VALUE } from "@/lib/group-scope-roles";
import { isAdminOrManagerLike } from "@/lib/roles";
import {
  ArrowRight,
  Building2,
  Percent,
  RefreshCw,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Objectif courant avec réalisé (réponse GET /api/goals/current pour un agent) */
interface CurrentGoal {
  periodLabel: string;
  targetConversions: number;
  targetRevenue: number;
  realizedConversions: number;
  realizedRevenue: number;
  user?: { id: string; name: string; email: string };
}

interface LeadStats {
  total: number;
  converted: number;
  conversionRate: number;
}

const initialLeadStats: LeadStats = {
  total: 0,
  converted: 0,
  conversionRate: 0,
};

interface RecentLead {
  id: string;
  companyName?: string;
  firstName: string;
  lastName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  contactsCount?: number;
  status: string;
  createdAt?: string;
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  ...NEGOTIATION_STAGE_LABELS,
};

const LEAD_STATUS_BADGE_STYLES: Record<string, string> = {
  ...NEGOTIATION_STAGE_STYLES,
};

function dashboardApiUrl(path: string, companyId?: string): string {
  if (!companyId?.trim()) return path;
  const params = new URLSearchParams({ companyId: companyId.trim() });
  return `${path}?${params.toString()}`;
}

function progressPct(realized: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (realized / target) * 100);
}

function progressBarColor(ratio: number): string {
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.5) return "bg-amber-500";
  return "bg-sky-500";
}

export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    scopeLabel,
    apiCompanyId,
  } = useGroupCompanyScope({ initialCompanyId: GROUP_HOLDING_SCOPE_VALUE });

  const [loading, setLoading] = useState(true);
  const [leadStats, setLeadStats] = useState<LeadStats>(initialLeadStats);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [currentGoal, setCurrentGoal] = useState<CurrentGoal | null>(null);
  const [teamGoals, setTeamGoals] = useState<CurrentGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isManagerLike = isAdminOrManagerLike(authUser?.role);

  const leadsScopeHint = useMemo(() => {
    if (hasGroupScope) return scopeLabel;
    return "Votre société";
  }, [hasGroupScope, scopeLabel]);

  const fetchCurrentGoal = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const res = await fetch(
        dashboardApiUrl("/api/goals/current", apiCompanyId),
        { cache: "no-store" },
      );
      if (!res.ok) {
        setCurrentGoal(null);
        setTeamGoals([]);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setTeamGoals(data);
        setCurrentGoal(null);
        return;
      }
      if (data && typeof data === "object") {
        setCurrentGoal(data);
        setTeamGoals([]);
      } else {
        setCurrentGoal(null);
        setTeamGoals([]);
      }
    } catch {
      setCurrentGoal(null);
      setTeamGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [apiCompanyId]);

  const fetchLeadStats = useCallback(async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch(dashboardApiUrl("/api/dashboard/lead-stats", apiCompanyId), {
          cache: "no-store",
        }).catch(() => null),
        fetch(dashboardApiUrl("/api/dashboard/recent-leads", apiCompanyId), {
          cache: "no-store",
        }).catch(() => null),
      ]);
      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setLeadStats({
          total: statsData?.total ?? 0,
          converted: statsData?.converted ?? 0,
          conversionRate: statsData?.conversionRate ?? 0,
        });
      }
      if (recentRes && recentRes.ok) {
        const recentData = (await recentRes.json()) as RecentLead[];
        setRecentLeads(Array.isArray(recentData) ? recentData : []);
      }
    } catch {
      setLeadStats(initialLeadStats);
      setRecentLeads([]);
    }
  }, [apiCompanyId]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([fetchCurrentGoal(), fetchLeadStats()]);
  }, [fetchCurrentGoal, fetchLeadStats]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshDashboard();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDashboard]);

  useEffect(() => {
    const handler = () => {
      void refreshDashboard();
    };
    window.addEventListener(GOALS_INVALIDATE_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(
        GOALS_INVALIDATE_EVENT,
        handler as EventListener,
      );
  }, [refreshDashboard]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshDashboard();
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(new Event(GOALS_INVALIDATE_EVENT));
    setRefreshing(false);
  };

  const teamGoalsPreview = teamGoals.slice(0, 3);
  const teamConversionsTarget = teamGoals.reduce(
    (s, g) => s + (g.targetConversions ?? 0),
    0,
  );
  const teamConversionsRealized = teamGoals.reduce(
    (s, g) => s + (g.realizedConversions ?? 0),
    0,
  );

  if (loading) {
    return (
      <DashboardShell title="Tableau de bord" subtitle="Chargement…">
        <SkeletonLoader />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Tableau de bord"
      subtitle={
        hasGroupScope
          ? `Activité commerciale — ${scopeLabel}`
          : "Vue synthétique de l'activité commerciale"
      }
    >
      <DashboardOnboardingCarousel />

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            Indicateurs clés, agenda du jour, répartition pipeline et derniers
            prospects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasGroupScope && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <GroupCompanySelect
                id="dashboard-company"
                label=""
                value={selectedCompanyId}
                options={companyOptions}
                includeHoldingOption
                fallbackOption={
                  authUser?.company
                    ? { id: authUser.company.id, name: authUser.company.name }
                    : undefined
                }
                onChange={setSelectedCompanyId}
                className="min-w-40"
                selectClassName="rounded-lg border-0 bg-transparent px-0 py-0 text-xs w-full sm:min-w-44 focus:outline-none focus:ring-0"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-600 shadow-sm transition hover:text-primary disabled:opacity-60"
            aria-label="Rafraîchir le tableau de bord"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>
        </div>
      </section>

      {/* KPIs compacts */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NeumoCard className="flex items-center gap-3 border border-gray-100 bg-white p-3.5 shadow-neu-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500">Total prospects</p>
            <p className="text-xl font-semibold tabular-nums text-primary">
              {leadStats.total}
            </p>
            <p className="truncate text-[10px] text-gray-400">{leadsScopeHint}</p>
          </div>
        </NeumoCard>

        <NeumoCard className="flex items-center gap-3 border border-gray-100 bg-white p-3.5 shadow-neu-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Percent className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500">Taux de conversion</p>
            <p className="text-xl font-semibold tabular-nums text-primary">
              {leadStats.conversionRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-400">Prospects → clients</p>
          </div>
        </NeumoCard>

        <NeumoCard className="flex items-center gap-3 border border-gray-100 bg-white p-3.5 shadow-neu-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <UserCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500">Leads convertis</p>
            <p className="text-xl font-semibold tabular-nums text-primary">
              {leadStats.converted}
            </p>
            <p className="text-[10px] text-gray-400">Ventes conclues</p>
          </div>
        </NeumoCard>
      </section>

      {/* Agenda du jour — tâches par commerciale */}
      <section>
        <DashboardAgendaToday
          companyId={apiCompanyId}
          groupByAgent={isManagerLike}
          refreshKey={refreshKey}
        />
      </section>

      {/* Objectifs */}
      <section>
        <NeumoCard className="flex flex-col gap-3 border border-gray-100 bg-white p-4 shadow-neu-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Target className="h-4 w-4 text-primary" />
              {isManagerLike ? "Objectifs de l'équipe" : "Mon objectif"}
            </p>
            {isManagerLike && (
              <Link
                href="/stats#stats-objectifs"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Voir le détail
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {goalsLoading ? (
            <p className="text-[11px] text-gray-500">Chargement…</p>
          ) : currentGoal ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-[11px]">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">
                    Conversions · {currentGoal.periodLabel}
                  </span>
                  <span className="font-semibold tabular-nums text-primary">
                    {currentGoal.realizedConversions} /{" "}
                    {currentGoal.targetConversions}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarColor(
                      currentGoal.targetConversions > 0
                        ? currentGoal.realizedConversions /
                            currentGoal.targetConversions
                        : 0,
                    )}`}
                    style={{
                      width: `${progressPct(
                        currentGoal.realizedConversions,
                        currentGoal.targetConversions,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">CA</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {Number(currentGoal.realizedRevenue ?? 0).toLocaleString(
                      "fr-FR",
                      {
                        style: "currency",
                        currency: "XOF",
                        maximumFractionDigits: 0,
                      },
                    )}{" "}
                    /{" "}
                    {Number(currentGoal.targetRevenue ?? 0).toLocaleString(
                      "fr-FR",
                      {
                        style: "currency",
                        currency: "XOF",
                        maximumFractionDigits: 0,
                      },
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarColor(
                      currentGoal.targetRevenue > 0
                        ? Number(currentGoal.realizedRevenue ?? 0) /
                            Number(currentGoal.targetRevenue ?? 0)
                        : 0,
                    )}`}
                    style={{
                      width: `${progressPct(
                        Number(currentGoal.realizedRevenue ?? 0),
                        Number(currentGoal.targetRevenue ?? 0),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : isManagerLike && teamGoals.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl bg-bgGray/70 px-3 py-2 text-[11px]">
                <span className="text-gray-500">
                  {teamGoals.length} commercial
                  {teamGoals.length > 1 ? "aux" : ""} avec objectif en cours
                </span>
                <span className="font-semibold tabular-nums text-primary">
                  {teamConversionsRealized} / {teamConversionsTarget}{" "}
                  conversions
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {teamGoalsPreview.map((g) => {
                  const ratio =
                    g.targetConversions > 0
                      ? g.realizedConversions / g.targetConversions
                      : 0;
                  return (
                    <div
                      key={g.user?.id ?? g.periodLabel}
                      className="rounded-xl border border-gray-100 bg-bgGray/40 px-3 py-2.5"
                    >
                      <p className="truncate text-[12px] font-medium text-gray-800">
                        {g.user?.name ?? "Commercial"}
                      </p>
                      <p className="text-[10px] text-gray-400">{g.periodLabel}</p>
                      <div className="mt-2 flex justify-between text-[10px]">
                        <span className="text-gray-500">Conv.</span>
                        <span className="tabular-nums font-medium text-gray-700">
                          {g.realizedConversions}/{g.targetConversions}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${progressBarColor(ratio)}`}
                          style={{
                            width: `${progressPct(
                              g.realizedConversions,
                              g.targetConversions,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {teamGoals.length > 3 && (
                <p className="text-[10px] text-gray-400">
                  +{teamGoals.length - 3} autre
                  {teamGoals.length - 3 > 1 ? "s" : ""} — détails sur
                  Statistiques
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              {isManagerLike
                ? "Aucun objectif en cours sur ce périmètre. Définissez-en depuis Utilisateurs, ou ouvrez Statistiques."
                : "Aucun objectif courant pour cette période."}
            </p>
          )}
        </NeumoCard>
      </section>

      {/* Graphiques */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NeumoCard className="flex flex-col gap-2 border border-gray-100 bg-white p-4 shadow-neu-soft">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Répartition des stades
            </p>
            <p className="text-[11px] text-gray-500">
              Pipeline par stade de négociation
            </p>
          </div>
          <ChartPieDonut companyId={apiCompanyId} embedded />
        </NeumoCard>

        <NeumoCard className="flex flex-col gap-2 border border-gray-100 bg-white p-4 shadow-neu-soft">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Répartition par source
            </p>
            <p className="text-[11px] text-gray-500">
              Origine d&apos;acquisition des prospects
            </p>
          </div>
          <ChartPieDonutBySource companyId={apiCompanyId} embedded />
        </NeumoCard>
      </section>

      {/* Derniers leads */}
      <section>
        <NeumoCard className="border border-gray-100 bg-white p-4 shadow-neu-soft">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Derniers prospects
              </p>
              <p className="text-[11px] text-gray-500">
                Les plus récemment créés sur ce périmètre
              </p>
            </div>
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              Voir tous
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Table containerClassName="max-h-[340px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Entreprise</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>{NEGOTIATION_STAGE_FIELD_LABEL}</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400">
                    Aucun prospect récent sur ce périmètre.
                  </TableCell>
                </TableRow>
              ) : (
                recentLeads.map((lead) => {
                  const companyLabel =
                    lead.companyName ||
                    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                    "—";
                  const contactLabel =
                    lead.contactName ||
                    lead.email ||
                    lead.phone ||
                    null;
                  const extraContacts =
                    (lead.contactsCount ?? 0) > 1
                      ? ` +${(lead.contactsCount ?? 0) - 1}`
                      : "";

                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {companyLabel}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {contactLabel ? (
                          <span className="text-gray-700">
                            {contactLabel}
                            {extraContacts && (
                              <span className="text-gray-400">
                                {extraContacts}
                              </span>
                            )}
                          </span>
                        ) : (
                          <TableEmpty />
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            LEAD_STATUS_BADGE_STYLES[lead.status] ??
                            "border border-gray-200 bg-gray-100 text-gray-600"
                          }`}
                        >
                          {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-gray-600">
                        {lead.createdAt ? (
                          new Date(lead.createdAt).toLocaleDateString("fr-FR")
                        ) : (
                          <TableEmpty />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </NeumoCard>
      </section>

      {isManagerLike && (
        <section>
          <Link
            href="/stats"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition hover:border-primary/20 hover:shadow-neu-soft"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-primary">
                Analyses avancées
              </p>
              <p className="text-[11px] text-gray-500">
                Type de client, sources, rôles décideurs, rapports de ventes et
                objectifs détaillés.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </section>
      )}
    </DashboardShell>
  );
}
