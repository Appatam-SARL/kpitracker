"use client";

import { useEffect, useState } from "react";
import { startOfWeek, endOfWeek } from "date-fns";
import { CalendarDays } from "lucide-react";
import { withDashboardLayout } from "@/components/layouts/withDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { hasGroupCompanyScopeFrontend } from "@/lib/roles";
import AgendaViewFilter from "@/components/agenda/AgendaViewFilter";
import type { AgendaView, CustomPeriod } from "@/components/agenda/AgendaViewFilter";
import AgendaCalendarBlock from "@/components/agenda/AgendaCalendarBlock";

type CompanyOpt = { id: string; name: string };
type UserOpt = { id: string; name: string };

function AgendaPageInner() {
  const { user: authUser } = useAuth();
  const hasGroupScope = hasGroupCompanyScopeFrontend(authUser?.role);

  const [view, setView] = useState<AgendaView>("semaine");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [customPeriod, setCustomPeriod] = useState<CustomPeriod>(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  });

  const [companyOptions, setCompanyOptions] = useState<CompanyOpt[]>([]);
  /** '' = ma société (pas de companyId dans l’URL calendrier) */
  const [agendaCompanyId, setAgendaCompanyId] = useState("");
  const [agendaUserId, setAgendaUserId] = useState("");
  const [agendaUsers, setAgendaUsers] = useState<UserOpt[]>([]);

  useEffect(() => {
    if (!hasGroupScope) return;
    const load = async () => {
      try {
        const res = await fetch("/api/companies/group", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setCompanyOptions(
            data.map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            })),
          );
        }
      } catch {
        // silencieux
      }
    };
    void load();
  }, [hasGroupScope]);

  useEffect(() => {
    if (!hasGroupScope || !agendaCompanyId) return;
    if (companyOptions.length === 0) return;
    if (!companyOptions.some((c) => c.id === agendaCompanyId)) {
      setAgendaCompanyId("");
      setAgendaUserId("");
    }
  }, [hasGroupScope, agendaCompanyId, companyOptions]);

  useEffect(() => {
    if (!hasGroupScope) return;
    const loadUsers = async () => {
      try {
        const params = new URLSearchParams({ role: "AGENT" });
        if (agendaCompanyId.trim()) {
          params.set("companyId", agendaCompanyId.trim());
        }
        const res = await fetch(`/api/users?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setAgendaUsers([]);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setAgendaUsers(
            data.map((u: { id: string; name: string }) => ({
              id: u.id,
              name: u.name,
            })),
          );
        } else {
          setAgendaUsers([]);
        }
      } catch {
        setAgendaUsers([]);
      }
    };
    void loadUsers();
  }, [hasGroupScope, agendaCompanyId]);

  useEffect(() => {
    if (
      agendaUserId &&
      agendaUsers.length > 0 &&
      !agendaUsers.some((u) => u.id === agendaUserId)
    ) {
      setAgendaUserId("");
    }
  }, [agendaUserId, agendaUsers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Bloc 1 : En-tête page Agenda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-primary">Agenda</h1>
            <p className="text-xs text-gray-500">
              Tâches et actions du commercial par jour, semaine, mois, année ou période personnalisée
            </p>
          </div>
        </div>
      </div>

      {/* Filtre entreprise + commerciale (directrice) */}
      {hasGroupScope && (
        <section className="rounded-2xl bg-white/80 border border-indigo-100/80 p-3">
          <p className="text-[11px] font-medium text-gray-600 mb-2">
            Filtrer par équipe
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[11px] text-gray-500" htmlFor="agenda-company">
                Entreprise
              </label>
              <select
                id="agenda-company"
                value={agendaCompanyId}
                onChange={(e) => {
                  setAgendaCompanyId(e.target.value);
                  setAgendaUserId("");
                }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              >
                <option value="">Ma société</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[11px] text-gray-500" htmlFor="agenda-user">
                Commerciale
              </label>
              <select
                id="agenda-user"
                value={agendaUserId}
                onChange={(e) => setAgendaUserId(e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              >
                <option value="">Choisir une commerciale…</option>
                {agendaUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Bloc 2 : Filtre de vue (Jour | Semaine | Mois | Année | Période) + choix des dates si Période */}
      <section className="rounded-2xl bg-white/80 border border-gray-100 p-3">
        <p className="text-[11px] font-medium text-gray-600 mb-2">Vue</p>
        <AgendaViewFilter
          value={view}
          onChange={setView}
          customPeriod={customPeriod}
          onCustomPeriodChange={setCustomPeriod}
        />
      </section>

      {/* Bloc 3 : Calendrier / liste des tâches selon le filtre */}
      <section aria-label="Tâches du commercial">
        <AgendaCalendarBlock
          view={view}
          currentDate={currentDate}
          onCurrentDateChange={setCurrentDate}
          customRange={view === "période" ? customPeriod : undefined}
          onCustomRangeChange={view === "période" ? setCustomPeriod : undefined}
          filterCompanyId={agendaCompanyId}
          filterAssignedUserId={agendaUserId}
          blockFetch={hasGroupScope && !agendaUserId.trim()}
        />
      </section>
    </div>
  );
}

export default withDashboardLayout(AgendaPageInner);
