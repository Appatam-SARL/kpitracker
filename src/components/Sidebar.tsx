'use client';

import { useAuth } from '@/contexts/AuthContext';
import type { FrontendRole } from '@/contexts/AuthContext';
import { GROUP_NAV_ROLES } from '@/lib/roles';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { BarChart3, BookOpen, Building2, CalendarDays, LayoutGrid, Package, Settings, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type SidebarItemDef = {
  icon: typeof LayoutGrid;
  label: string;
  href: string;
  /** Si défini, seuls ces rôles voient l’entrée (AGENT ne voit pas Utilisateurs ni Paramètres). */
  allowedRoles?: FrontendRole[];
};

// Les groupes de routes entre parenthèses (ex: (dashboard)) ne font pas partie de l'URL publique.
export const sidebarItems: SidebarItemDef[] = [
  { icon: LayoutGrid, label: 'Dashboard', href: '/' },
  { icon: CalendarDays, label: 'Agenda', href: '/agenda' },
  { icon: UserPlus, label: 'Leads', href: '/leads' },
  { icon: BarChart3, label: 'Statistiques', href: '/stats', allowedRoles: [...GROUP_NAV_ROLES] },
  { icon: Package, label: 'Produits et services', href: '/products-services', allowedRoles: [...GROUP_NAV_ROLES] },
  { icon: Building2, label: 'Clients', href: '/clients' },
  { icon: Trash2, label: 'Corbeille', href: '/corbeille', allowedRoles: [...GROUP_NAV_ROLES] },
  { icon: BookOpen, label: 'Guide', href: '/guide' },
  { icon: Users, label: 'Utilisateurs', href: '/users', allowedRoles: [...GROUP_NAV_ROLES] },
  { icon: Settings, label: 'Paramètres', href: '/settings', allowedRoles: [...GROUP_NAV_ROLES] },
];

/** Retourne les entrées de menu visibles pour le rôle (AGENT n’a pas Utilisateurs ni Paramètres). */
export function getSidebarItemsForRole(role: FrontendRole | null): SidebarItemDef[] {
  if (!role) return sidebarItems.filter((i) => !i.allowedRoles?.length);
  return sidebarItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role)
  );
}

/** Routes déjà présentes dans la barre d’onglets mobile (exclues du drawer). */
export const MOBILE_PRIMARY_NAV_HREFS = [
  '/',
  '/agenda',
  '/leads',
  '/clients',
  '/stats',
] as const;

/** Menus secondaires pour le drawer mobile (sidebar − navigation principale mobile). */
export function getSecondaryNavItemsForRole(
  role: FrontendRole | null,
): SidebarItemDef[] {
  const primary = new Set<string>(MOBILE_PRIMARY_NAV_HREFS);
  return getSidebarItemsForRole(role).filter((item) => !primary.has(item.href));
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const items = getSidebarItemsForRole(user?.role ?? null);

  const [expanded, setExpanded] = useState<boolean | null>(null);

  // Optionnel : persistance dans localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('crm_sidebar_expanded');
      setExpanded(stored === 'true');
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('crm_sidebar_expanded', expanded ? 'true' : 'false');
    } catch {
      // silencieux
    }
  }, [expanded]);

  const handleNavigate = (href: string) => {
    if (href && href !== pathname) {
      router.push(href);
    }
  };

  // Ne rien rendre tant que l'état initial (localStorage) n'est pas résolu
  if (expanded === null) return null;

  return (
    <aside
      className={`hidden sm:flex flex-col justify-between py-6 bg-[#f5f5ff] border-r border-primary/10 transition-all duration-200 sticky top-0 h-screen ${
        expanded ? 'w-56 px-4' : 'w-16 px-3'
      }`}
    >
      <div className='flex flex-col gap-6'>
        <div className='flex items-center justify-between gap-2'>
          <button
            type='button'
            onClick={() => handleNavigate('/')}
            className={`h-9 rounded-2xl shadow-neu flex items-center justify-center gap-2 bg-white border border-sky-200/80 text-sky-900 text-[11px] font-semibold tracking-wide ${
              expanded ? 'px-2.5' : 'px-0 w-9'
            }`}
            aria-label='KpiTracker'
          >
            <Image
              src='/kpitracker-mark.svg'
              alt=''
              width={28}
              height={28}
              className='h-7 w-7 shrink-0'
            />
            {expanded && <span className='truncate'>KpiTracker</span>}
          </button>
          <button
            type='button'
            onClick={() => setExpanded((prev) => !prev)}
            className='ml-1 inline-flex items-center justify-center w-7 h-7 rounded-xl bg-bgGray text-gray-600 hover:text-primary shadow-neu'
            aria-label={expanded ? 'Réduire le menu' : 'Développer le menu'}
          >
            <span className='text-xs'>{expanded ? '«' : '»'}</span>
          </button>
        </div>

        <nav
          className={`flex flex-col gap-4 ${
            expanded ? 'items-stretch' : 'items-center'
          }`}
        >
          {items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            const buttonContent = (
              <>
                <item.icon className='w-4 h-4 shrink-0' />
                {expanded && (
                  <span
                    className={`text-[11px] font-medium truncate ${
                      isActive ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </>
            );

            const button = (
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                type='button'
                onClick={() => handleNavigate(item.href)}
                className={`rounded-2xl flex transition-colors ${
                  expanded
                    ? 'w-full px-3 py-2 gap-2 items-center justify-start'
                    : 'w-9 h-9 items-center justify-center'
                } ${
                  isActive
                    ? 'bg-primary text-white shadow-neu'
                    : 'bg-bgGray text-gray-500 shadow-neu hover:text-primary'
                }`}
                aria-label={item.label}
              >
                {buttonContent}
              </motion.button>
            );

            const showTooltip = !expanded;

            return (
              <div
                key={item.label}
                className='group relative flex items-center justify-center'
              >
                {button}
                {showTooltip && (
                  <span
                    className='pointer-events-none absolute left-full ml-3 z-50 px-2.5 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100'
                    role='tooltip'
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
