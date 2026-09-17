'use client';

import { useAuth } from '@/contexts/AuthContext';
import type { FrontendRole } from '@/contexts/AuthContext';
import { getRoleLabel, GROUP_NAV_ROLES, normalizeFrontendRole } from '@/lib/roles';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Factory,
  LayoutGrid,
  Package,
  Settings,
  Trash2,
  User,
  Users,
  FileText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type SidebarSectionId = 'principal' | 'pilotage' | 'systeme';

export type SidebarItemDef = {
  icon: typeof LayoutGrid;
  label: string;
  href: string;
  section: SidebarSectionId;
  /** Si défini, seuls ces rôles voient l’entrée (AGENT ne voit pas Utilisateurs ni Paramètres). */
  allowedRoles?: FrontendRole[];
};

const SECTION_LABELS: Record<SidebarSectionId, string> = {
  principal: 'Principal',
  pilotage: 'Pilotage',
  systeme: 'Système',
};

const SECTION_ORDER: SidebarSectionId[] = ['principal', 'pilotage', 'systeme'];

// Les groupes de routes entre parenthèses (ex: (dashboard)) ne font pas partie de l'URL publique.
export const sidebarItems: SidebarItemDef[] = [
  { icon: LayoutGrid, label: 'Dashboard', href: '/', section: 'principal' },
  { icon: CalendarDays, label: 'Agenda', href: '/agenda', section: 'principal' },
  { icon: ContactRound, label: 'Gestion Contacts', href: '/leads', section: 'principal' },
  { icon: Factory, label: 'Gestion des prospects', href: '/entreprises', section: 'principal' },
  { icon: Building2, label: 'Gestion Clients', href: '/clients', section: 'principal' },
  {
    icon: BarChart3,
    label: 'Statistiques',
    href: '/stats',
    section: 'pilotage',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
  {
    icon: FileText,
    label: 'Rapport',
    href: '/rapport',
    section: 'pilotage',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
  {
    icon: Package,
    label: 'Produits et services',
    href: '/products-services',
    section: 'pilotage',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
  { icon: BookOpen, label: 'Guide', href: '/guide', section: 'systeme' },
  {
    icon: Trash2,
    label: 'Corbeille',
    href: '/corbeille',
    section: 'systeme',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
  {
    icon: Users,
    label: 'Utilisateurs',
    href: '/users',
    section: 'systeme',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
  {
    icon: Settings,
    label: 'Paramètres',
    href: '/settings',
    section: 'systeme',
    allowedRoles: [...GROUP_NAV_ROLES],
  },
];

/** Retourne les entrées de menu visibles pour le rôle (AGENT n’a pas Utilisateurs ni Paramètres). */
export function getSidebarItemsForRole(role: FrontendRole | null): SidebarItemDef[] {
  if (!role) return sidebarItems.filter((i) => !i.allowedRoles?.length);
  return sidebarItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(role),
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

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function roleDisplayLabel(role: string | undefined): string {
  if (!role) return '';
  const normalized = normalizeFrontendRole(role);
  if (normalized === 'admin') return 'Administrateur';
  return getRoleLabel(normalized);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const items = getSidebarItemsForRole(user?.role ?? null);

  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('crm_sidebar_expanded');
      if (stored === 'true' || stored === 'false') {
        setExpanded(stored === 'true');
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'crm_sidebar_expanded',
        expanded ? 'true' : 'false',
      );
    } catch {
      // silencieux
    }
  }, [expanded]);

  const sections = useMemo(() => {
    return SECTION_ORDER.map((id) => ({
      id,
      label: SECTION_LABELS[id],
      items: items.filter((item) => item.section === id),
    })).filter((section) => section.items.length > 0);
  }, [items]);

  const handleNavigate = (href: string) => {
    if (href && href !== pathname) {
      router.push(href);
    }
  };

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <aside
      className={`hidden sm:flex flex-col bg-[#f5f5ff] border-r border-primary/10 transition-[width,padding] duration-200 sticky top-0 h-screen ${
        expanded ? 'w-56 px-3' : 'w-17 px-2'
      }`}
      aria-label='Navigation principale'
    >
      {/* En-tête marque + collapse */}
      <div
        className={`flex shrink-0 items-center gap-1.5 pt-5 pb-4 ${
          expanded ? 'justify-between px-1' : 'flex-col gap-2'
        }`}
      >
        <button
          type='button'
          onClick={() => handleNavigate('/')}
          className={`flex h-10 items-center gap-2 rounded-2xl border border-sky-200/70 bg-white text-sky-900 shadow-neu-soft transition hover:border-sky-300 ${
            expanded ? 'min-w-0 flex-1 px-2.5' : 'w-10 justify-center px-0'
          }`}
          aria-label='Accueil KpiTracker'
        >
          <Image
            src='/kpitracker-mark.png'
            alt=''
            width={28}
            height={28}
            className='h-7 w-7 shrink-0'
          />
          {expanded && (
            <span className='truncate text-[12px] font-semibold tracking-wide'>
              KpiTracker
            </span>
          )}
        </button>

        <button
          type='button'
          onClick={toggleExpanded}
          className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 shadow-neu-soft transition hover:text-primary'
          aria-label={expanded ? 'Réduire le menu' : 'Développer le menu'}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronLeft className='h-4 w-4' strokeWidth={2} />
          ) : (
            <ChevronRight className='h-4 w-4' strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Navigation scrollable */}
      <nav
        className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pb-3 ${
          expanded ? 'px-0.5' : 'items-center'
        }`}
      >
        {sections.map((section) => (
          <div
            key={section.id}
            className={`flex flex-col gap-1 ${expanded ? '' : 'items-center'}`}
          >
            {expanded ? (
              <p className='px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400'>
                {section.label}
              </p>
            ) : (
              <div
                className='mb-0.5 h-px w-6 bg-primary/15'
                aria-hidden
              />
            )}

            {section.items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <div
                  key={item.href}
                  className='group relative flex w-full items-center justify-center'
                >
                  <motion.button
                    whileHover={{ scale: expanded ? 1.01 : 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    type='button'
                    onClick={() => handleNavigate(item.href)}
                    className={`relative flex transition-colors ${
                      expanded
                        ? 'w-full items-center gap-2.5 rounded-xl px-2.5 py-2'
                        : 'h-10 w-10 items-center justify-center rounded-xl'
                    } ${
                      isActive
                        ? 'bg-primary text-white shadow-neu'
                        : 'text-gray-600 hover:bg-white/80 hover:text-primary'
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={!expanded ? item.label : undefined}
                  >
                    {expanded && isActive && (
                      <span
                        className='absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white/90'
                        aria-hidden
                      />
                    )}
                    <Icon
                      className='h-4 w-4 shrink-0'
                      strokeWidth={isActive ? 2.25 : 1.85}
                    />
                    {expanded && (
                      <span
                        className={`min-w-0 truncate text-[12px] font-medium ${
                          isActive ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </motion.button>

                  {!expanded && (
                    <span
                      className='pointer-events-none absolute left-full z-50 ml-2.5 whitespace-nowrap rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100'
                      role='tooltip'
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Pied profil */}
      {user && (
        <div
          className={`shrink-0 border-t border-primary/10 py-3 ${
            expanded ? 'px-0.5' : 'flex justify-center'
          }`}
        >
          <button
            type='button'
            onClick={() => handleNavigate('/profile')}
            className={`group relative flex items-center gap-2.5 rounded-xl transition hover:bg-white/80 ${
              expanded
                ? 'w-full px-2 py-2'
                : 'h-10 w-10 justify-center'
            } ${
              isNavItemActive(pathname, '/profile')
                ? 'bg-white shadow-neu-soft'
                : ''
            }`}
            aria-label='Mon profil'
            title={!expanded ? user.name : undefined}
          >
            <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary'>
              {user.name ? getInitials(user.name) : <User className='h-4 w-4' />}
            </span>
            {expanded && (
              <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-[12px] font-semibold text-gray-800'>
                  {user.name}
                </span>
                <span className='block truncate text-[10px] text-gray-400'>
                  {roleDisplayLabel(user.role)}
                </span>
              </span>
            )}
            {!expanded && (
              <span
                className='pointer-events-none absolute left-full z-50 ml-2.5 whitespace-nowrap rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100'
                role='tooltip'
              >
                {user.name}
              </span>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
