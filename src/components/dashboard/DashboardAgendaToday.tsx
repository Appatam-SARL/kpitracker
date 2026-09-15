'use client';

import NeumoCard from '@/components/NeumoCard';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AgendaStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

type AgendaTodayItem = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  status: AgendaStatus;
  createdBy?: { id: string; name: string } | null;
  prospect?: { id: string; name: string } | null;
};

type AgentGroup = {
  id: string;
  name: string;
  items: AgendaTodayItem[];
};

type DashboardAgendaTodayProps = {
  companyId?: string;
  /** Vue manager / admin / groupe : regroupe par commerciale */
  groupByAgent?: boolean;
  refreshKey?: number;
};

const STATUS_META: Record<
  AgendaStatus,
  { label: string; className: string; icon: typeof Circle }
> = {
  TODO: {
    label: 'À faire',
    className: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: Circle,
  },
  IN_PROGRESS: {
    label: 'En cours',
    className: 'bg-sky-50 text-sky-700 border-sky-100',
    icon: Clock3,
  },
  DONE: {
    label: 'Terminé',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: CheckCircle2,
  },
};

function startAndEndOfToday(): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

export default function DashboardAgendaToday({
  companyId,
  groupByAgent = false,
  refreshKey = 0,
}: DashboardAgendaTodayProps) {
  const [items, setItems] = useState<AgendaTodayItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = startAndEndOfToday();
      const params = new URLSearchParams({ from, to });
      if (companyId?.trim()) params.set('companyId', companyId.trim());
      const res = await fetch(`/api/agenda/calendar?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchToday();
  }, [fetchToday, refreshKey]);

  const groups = useMemo<AgentGroup[]>(() => {
    if (!groupByAgent) {
      return [
        {
          id: 'me',
          name: 'Mes tâches',
          items,
        },
      ];
    }

    const map = new Map<string, AgentGroup>();
    for (const item of items) {
      const id = item.createdBy?.id ?? 'unknown';
      const name = item.createdBy?.name?.trim() || 'Commercial(e)';
      const existing = map.get(id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(id, { id, name, items: [item] });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
    );
  }, [groupByAgent, items]);

  const openCount = items.filter((item) => item.status !== 'DONE').length;
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <NeumoCard className='flex flex-col gap-3 border border-gray-100 bg-white p-4 shadow-neu-soft'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='flex items-start gap-2.5 min-w-0'>
          <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <CalendarDays className='h-5 w-5' strokeWidth={1.75} />
          </span>
          <div className='min-w-0'>
            <h2 className='text-sm font-semibold text-primary'>
              Agenda du jour
            </h2>
            <p className='text-[11px] text-gray-500 capitalize'>{todayLabel}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {!loading ? (
            <span className='rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-600'>
              {openCount} ouverte{openCount > 1 ? 's' : ''} · {items.length}{' '}
              au total
            </span>
          ) : null}
          <Link
            href='/agenda'
            className='inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline'
          >
            Voir l&apos;agenda
            <ArrowRight className='h-3.5 w-3.5' />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className='space-y-2'>
          <div className='h-16 animate-pulse rounded-xl bg-gray-100' />
          <div className='h-16 animate-pulse rounded-xl bg-gray-100' />
        </div>
      ) : items.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-6 text-center'>
          <p className='text-[12px] text-gray-500'>
            Aucune tâche prévue aujourd&apos;hui
            {groupByAgent ? ' pour l&apos;équipe' : ''}.
          </p>
          <Link
            href='/agenda'
            className='mt-2 inline-flex text-[11px] font-medium text-primary hover:underline'
          >
            Planifier une tâche
          </Link>
        </div>
      ) : (
        <div className='space-y-3 max-h-[420px] overflow-y-auto pr-1'>
          {groups.map((group) => (
            <div
              key={group.id}
              className='rounded-2xl border border-gray-100 bg-gray-50/60 p-3'
            >
              {groupByAgent ? (
                <div className='mb-2.5 flex items-center gap-2'>
                  <span className='flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white'>
                    {initials(group.name)}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-[12px] font-semibold text-primary'>
                      {group.name}
                    </p>
                    <p className='text-[10px] text-gray-400'>
                      {group.items.length} tâche
                      {group.items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ) : null}

              <ul className='space-y-2'>
                {group.items.map((item) => {
                  const meta = STATUS_META[item.status] ?? STATUS_META.TODO;
                  const StatusIcon = meta.icon;
                  return (
                    <li
                      key={item.id}
                      className='rounded-xl border border-gray-100 bg-white px-3 py-2.5'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='truncate text-[12px] font-medium text-primary'>
                            {item.title}
                          </p>
                          <p className='mt-0.5 truncate text-[10px] text-gray-500'>
                            {formatTime(item.dueDate)}
                            {item.prospect?.name
                              ? ` · ${item.prospect.name}`
                              : ''}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${meta.className}`}
                        >
                          <StatusIcon className='h-3 w-3' />
                          {meta.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </NeumoCard>
  );
}
