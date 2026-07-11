'use client';

import NeumoCard from '@/components/NeumoCard';
import GroupCompanySelect from '@/components/GroupCompanySelect';
import {
  GoalSetSheet,
  type ExistingGoalForEdit,
} from '@/components/GoalSetSheet';
import UserCreateSheet from '@/components/UserCreateSheet';
import UserRoleBadge from '@/components/UserRoleBadge';
import { UserEditSheet } from '@/components/UserEditSheet';
import type { FrontendRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupCompanyScope } from '@/hooks/useGroupCompanyScope';
import {
  USER_ROLE_FILTER_OPTIONS,
  canManageUserAccounts,
  canSetAgentGoal,
  canTrashUserAccounts,
  frontendRoleToApi,
  hasGroupCompanyScopeFrontend,
  normalizeFrontendRole,
} from '@/lib/roles';
import { withDashboardLayout } from '@/components/layouts/withDashboardLayout';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SkeletonLoader from '@/components/SkeletonLoader';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: FrontendRole;
  status: 'active' | 'invited' | 'suspended';
  lastLogin: string;
}

type CurrentGoalRow = {
  id: string;
  periodType: 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';
  periodStart: string;
  periodLabel: string;
  targetConversions: number;
  targetRevenue: number;
  user: { id: string; name: string; email: string };
};

function formatRevenue(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function UsersPageInner() {
  const router = useRouter();
  const { user: authUser, loading } = useAuth();
  const {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    apiCompanyId,
    scopeLabel,
  } = useGroupCompanyScope();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roleFilter, setRoleFilter] = useState<FrontendRole | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [goalUser, setGoalUser] = useState<UserRow | null>(null);
  const [goalSheetMode, setGoalSheetMode] = useState<'create' | 'edit'>('create');
  const [existingGoalForSheet, setExistingGoalForSheet] =
    useState<ExistingGoalForEdit | null>(null);
  const [currentGoalsByUserId, setCurrentGoalsByUserId] = useState<
    Map<string, CurrentGoalRow>
  >(new Map());
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!authUser || authUser.role === 'agent') {
      router.replace('/');
      return;
    }
  }, [authUser, loading, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'agent') {
      setRoleFilter('agent');
    }
  }, []);

  const loadUsersAndGoals = useCallback(async () => {
    if (!authUser || authUser.role === 'agent') return;

    try {
      setUsersLoading(true);
      const usersParams = new URLSearchParams();
      if (hasGroupScope && apiCompanyId) {
        usersParams.set('companyId', apiCompanyId);
      }
      if (roleFilter !== 'all') {
        usersParams.set('role', frontendRoleToApi(roleFilter));
      }

      const usersUrl = usersParams.toString()
        ? `/api/users?${usersParams.toString()}`
        : '/api/users';

      const shouldLoadGoals =
        hasGroupScope || canSetAgentGoal(authUser.role);
      const goalsParams = new URLSearchParams();
      if (hasGroupScope && apiCompanyId) {
        goalsParams.set('companyId', apiCompanyId);
      }
      const goalsUrl = shouldLoadGoals
        ? goalsParams.toString()
          ? `/api/goals/current?${goalsParams.toString()}`
          : '/api/goals/current'
        : null;

      const [usersRes, goalsRes] = await Promise.all([
        fetch(usersUrl),
        goalsUrl ? fetch(goalsUrl) : Promise.resolve(null),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        const mapped: UserRow[] = data.map((u: { id: string; name: string; email: string; role: string; createdAt: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: normalizeFrontendRole(u.role),
          status: 'active',
          lastLogin: new Date(u.createdAt).toLocaleString('fr-FR'),
        }));
        setUsers(mapped);
      }

      if (goalsRes?.ok) {
        const goalsData = await goalsRes.json();
        const map = new Map<string, CurrentGoalRow>();
        if (Array.isArray(goalsData)) {
          for (const g of goalsData as CurrentGoalRow[]) {
            map.set(g.user.id, g);
          }
        }
        setCurrentGoalsByUserId(map);
      } else if (!goalsUrl) {
        setCurrentGoalsByUserId(new Map());
      }
    } catch {
      // silencieux
    } finally {
      setUsersLoading(false);
    }
  }, [authUser, hasGroupScope, apiCompanyId, roleFilter]);

  useEffect(() => {
    void loadUsersAndGoals();
  }, [loadUsersAndGoals]);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery =
          !query ||
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesQuery && matchesRole;
      }),
    [query, roleFilter, users],
  );

  const showGoalColumn =
    hasGroupCompanyScopeFrontend(authUser?.role) ||
    canSetAgentGoal(authUser?.role);

  const openGoalSheet = (user: UserRow) => {
    const current = currentGoalsByUserId.get(user.id);
    if (current) {
      setGoalSheetMode('edit');
      setExistingGoalForSheet({
        id: current.id,
        periodType: current.periodType,
        periodStart: current.periodStart,
        periodLabel: current.periodLabel,
        targetConversions: current.targetConversions,
        targetRevenue: current.targetRevenue,
      });
    } else {
      setGoalSheetMode('create');
      setExistingGoalForSheet(null);
    }
    setGoalUser(user);
  };

  const closeGoalSheet = (open: boolean) => {
    if (!open) {
      setGoalUser(null);
      setExistingGoalForSheet(null);
      setGoalSheetMode('create');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-gray-500 text-sm">
        Chargement…
      </div>
    );
  }

  if (!authUser || authUser.role === 'agent') {
    return null;
  }

  const pageSubtitle = hasGroupScope
    ? `Consultez les commerciales de chaque entreprise du groupe — ${scopeLabel}.`
    : "Gérez les comptes, les rôles et les droits d'accès de votre équipe.";

  return (
    <>
      <section className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2'>
        <div>
          <h1 className='text-xl md:text-2xl font-semibold text-primary'>
            Utilisateurs
          </h1>
          <p className='text-xs md:text-sm text-gray-500'>{pageSubtitle}</p>
        </div>
        {canManageUserAccounts(authUser.role) && (
          <button
            type='button'
            onClick={() => setCreateOpen(true)}
            className='inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-white text-xs font-medium shadow-neu'
          >
            <Plus className='w-3.5 h-3.5' /> Ajouter un utilisateur
          </button>
        )}
      </section>

      {hasGroupScope && (
        <div className='mt-4'>
          <GroupCompanySelect
            id='users-company'
            label='Entreprise'
            value={selectedCompanyId}
            options={companyOptions}
            fallbackOption={
              authUser.company
                ? { id: authUser.company.id, name: authUser.company.name }
                : undefined
            }
            onChange={setSelectedCompanyId}
          />
        </div>
      )}

      <NeumoCard className='mt-4 p-4 bg-white flex flex-col gap-4'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
          <div className='flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100 text-xs w-full md:w-72'>
            <Search className='w-4 h-4 text-gray-400' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Rechercher par nom ou email'
              className='bg-transparent outline-none flex-1 text-[11px] text-gray-700'
              disabled={usersLoading}
            />
          </div>
          <div className='flex items-center gap-1 text-[11px] bg-gray-50 rounded-full p-1 border border-gray-100 w-fit overflow-x-auto'>
            {USER_ROLE_FILTER_OPTIONS.map(([role, label]) => (
              <button
                key={role}
                type='button'
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
                  roleFilter === role
                    ? 'bg-white text-primary shadow-neu'
                    : 'text-gray-500 hover:text-primary'
                }`}
                disabled={usersLoading}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {usersLoading ? (
          <div className='mt-2 space-y-3'>
            <div className='flex items-center justify-between text-[11px] text-gray-400 mb-1'>
              <SkeletonLoader className='h-3 w-24' />
              <SkeletonLoader className='h-3 w-20' />
            </div>
            <div className='space-y-2'>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className='flex items-center justify-between rounded-2xl border border-gray-100 px-3 py-3'
                >
                  <div className='flex items-center gap-2'>
                    <SkeletonLoader className='w-7 h-7 rounded-full' />
                    <div className='flex flex-col gap-1'>
                      <SkeletonLoader className='h-3 w-28' />
                      <SkeletonLoader className='h-3 w-40' />
                    </div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <SkeletonLoader className='h-4 w-16 rounded-full' />
                    <SkeletonLoader className='h-4 w-16 rounded-full' />
                    <SkeletonLoader className='h-4 w-24' />
                    <SkeletonLoader className='h-7 w-7 rounded-full' />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto mt-2'>
            <table className='min-w-full text-xs'>
              <thead className='text-gray-400'>
                <tr className='border-b border-gray-100'>
                  <th className='py-2 text-left font-medium'>Utilisateur</th>
                  <th className='py-2 text-left font-medium'>Rôle</th>
                  {showGoalColumn && (
                    <th className='py-2 text-left font-medium'>Objectif en cours</th>
                  )}
                  <th className='py-2 text-left font-medium'>Statut</th>
                  <th className='py-2 text-left font-medium'>
                    Dernière connexion
                  </th>
                  <th className='py-2 text-right font-medium'>Actions</th>
                </tr>
              </thead>
              <tbody className='text-gray-700'>
                {filtered.map((user) => {
                  const currentGoal = currentGoalsByUserId.get(user.id);
                  return (
                    <tr
                      key={user.id}
                      className='border-b border-gray-50 hover:bg-gray-50/60'
                    >
                      <td className='py-2'>
                        <div className='flex items-center gap-2'>
                          <div className='w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center text-[11px] font-semibold'>
                            {user.name[0]}
                          </div>
                          <div className='flex flex-col'>
                            <span className='text-xs font-medium'>{user.name}</span>
                            <span className='text-[11px] text-gray-500'>
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className='py-2'>
                        <UserRoleBadge role={user.role} />
                      </td>
                      {showGoalColumn && (
                        <td className='py-2 text-[11px] text-gray-500'>
                          {user.role === 'agent' ? (
                            currentGoal ? (
                              <span>
                                {currentGoal.periodLabel} —{' '}
                                {formatRevenue(currentGoal.targetRevenue)} XOF
                              </span>
                            ) : (
                              <span className='text-gray-400'>Aucun</span>
                            )
                          ) : (
                            <span className='text-gray-300'>—</span>
                          )}
                        </td>
                      )}
                      <td className='py-2'>
                        {user.status === 'active' && (
                          <span className='px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px]'>
                            Actif
                          </span>
                        )}
                        {user.status === 'invited' && (
                          <span className='px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px]'>
                            Invitation envoyée
                          </span>
                        )}
                        {user.status === 'suspended' && (
                          <span className='px-2 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px]'>
                            Suspendu
                          </span>
                        )}
                      </td>
                      <td className='py-2 text-[11px] text-gray-500'>
                        {user.lastLogin}
                      </td>
                      <td className='py-2 text-right relative'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type='button'
                              className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-500 hover:text-primary border border-gray-100'
                            >
                              <MoreHorizontal className='w-4 h-4' />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side='bottom' align='end'>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                router.push(`/profile?userId=${user.id}`);
                              }}
                            >
                              Voir
                            </DropdownMenuItem>
                            {canSetAgentGoal(authUser.role) &&
                              user.role === 'agent' && (
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    openGoalSheet(user);
                                  }}
                                >
                                  {currentGoal
                                    ? 'Redéfinir objectif'
                                    : 'Définir objectif'}
                                </DropdownMenuItem>
                              )}
                            {canManageUserAccounts(authUser.role) && (
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setEditingUser(user);
                                }}
                              >
                                Modifier
                              </DropdownMenuItem>
                            )}
                            {canTrashUserAccounts(authUser.role) &&
                              user.id !== authUser.id &&
                              user.role !== 'admin' && (
                                <DropdownMenuItem
                                  className='text-rose-600'
                                  onSelect={async (e) => {
                                    e.preventDefault();
                                    const confirmed = window.confirm(
                                      `Mettre l'utilisateur ${user.name} à la corbeille ? Un responsable pourra le restaurer.`,
                                    );
                                    if (!confirmed) return;
                                    try {
                                      const res = await fetch(
                                        `/api/users?id=${user.id}`,
                                        { method: 'DELETE' },
                                      );
                                      if (!res.ok) {
                                        const body = (await res
                                          .json()
                                          .catch(() => null)) as {
                                          error?: string;
                                        } | null;
                                        window.alert(
                                          body?.error ??
                                            'Impossible de mettre cet utilisateur à la corbeille.',
                                        );
                                        return;
                                      }
                                      setUsers((prev) =>
                                        prev.filter((u) => u.id !== user.id),
                                      );
                                    } catch {
                                      window.alert(
                                        'Impossible de mettre cet utilisateur à la corbeille.',
                                      );
                                    }
                                  }}
                                >
                                  Mettre à la corbeille
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className='py-8 text-center text-[12px] text-gray-500'>
                Aucun utilisateur ne correspond à votre recherche.
              </div>
            )}
          </div>
        )}
      </NeumoCard>
      <UserCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(user) =>
          setUsers((prev) => [
            { ...user, status: 'active', lastLogin: "À l'instant" },
            ...prev,
          ])
        }
      />
      <UserEditSheet
        open={editingUser !== null}
        user={editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onUpdated={(updated) =>
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
          )
        }
      />
      <GoalSetSheet
        open={goalUser !== null}
        user={
          goalUser
            ? { id: goalUser.id, name: goalUser.name, role: goalUser.role }
            : null
        }
        mode={goalSheetMode}
        existingGoal={existingGoalForSheet}
        crossCompanyScope={hasGroupScope}
        onOpenChange={closeGoalSheet}
        onSaved={() => void loadUsersAndGoals()}
      />
    </>
  );
}

const UsersPage = withDashboardLayout(UsersPageInner);

export default UsersPage;
