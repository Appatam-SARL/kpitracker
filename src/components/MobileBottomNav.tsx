'use client';

import { useAuth } from '@/contexts/AuthContext';
import type { FrontendRole } from '@/contexts/AuthContext';
import {
  BarChart3,
  Building2,
  CalendarDays,
  ContactRound,
  Home,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { GROUP_NAV_ROLES } from '@/lib/roles';

const STATS_ROLES: FrontendRole[] = [...GROUP_NAV_ROLES];

const LEFT_TABS = [
  { icon: Home, label: 'Accueil', href: '/' },
  { icon: CalendarDays, label: 'Agenda', href: '/agenda' },
] as const;

const RIGHT_TABS = [
  { icon: ContactRound, label: 'Contacts', href: '/leads' },
  { icon: Building2, label: 'Clients', href: '/clients' },
] as const;

const STATS_HREF = '/stats';

function isTabActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TabButtonProps = {
  icon: typeof Home;
  label: string;
  href: string;
  isActive: boolean;
  onNavigate: (href: string) => void;
};

function TabButton({
  icon: Icon,
  label,
  href,
  isActive,
  onNavigate,
}: TabButtonProps) {
  return (
    <button
      type='button'
      onClick={() => onNavigate(href)}
      className='flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2'
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={`h-6 w-6 shrink-0 transition-colors ${
          isActive ? 'text-sky-600' : 'text-sky-500/80'
        }`}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      <span
        className={`max-w-full truncate px-0.5 text-[10px] font-medium leading-tight ${
          isActive ? 'text-sky-600' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function StatsCenterButton({
  isActive,
  onNavigate,
}: {
  isActive: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className='flex w-[72px] shrink-0 items-center justify-center'>
      <button
        type='button'
        onClick={() => onNavigate(STATS_HREF)}
        className={`relative -top-5 flex h-[58px] w-[58px] flex-col items-center justify-center gap-0.5 rounded-full border-[2.5px] bg-white shadow-md transition-transform active:scale-95 ${
          isActive
            ? 'border-sky-600 ring-2 ring-sky-100'
            : 'border-sky-500'
        }`}
        aria-label='Statistiques'
        aria-current={isActive ? 'page' : undefined}
      >
        <span className='flex h-[44px] w-[44px] items-center justify-center rounded-full bg-linear-to-br from-sky-50 to-sky-100'>
          <BarChart3
            className={`h-6 w-6 ${isActive ? 'text-sky-700' : 'text-sky-600'}`}
            strokeWidth={isActive ? 2.25 : 1.75}
          />
        </span>
        <span
          className={`text-[9px] font-semibold leading-none ${
            isActive ? 'text-sky-600' : 'text-gray-500'
          }`}
        >
          Stats
        </span>
      </button>
    </div>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const showStatsCenter =
    user?.role != null && STATS_ROLES.includes(user.role);

  const statsActive = isTabActive(pathname, STATS_HREF);

  const handleNavigate = (href: string) => {
    if (href && href !== pathname) {
      router.push(href);
    }
  };

  return (
    <nav
      className='fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:hidden'
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label='Navigation principale'
    >
      <div
        className={`relative flex min-h-[60px] items-end justify-between px-1 pt-1 pb-1 ${
          showStatsCenter ? '' : 'gap-0'
        }`}
      >
        <div className='flex min-w-0 flex-1'>
          {LEFT_TABS.map((tab) => (
            <TabButton
              key={tab.href}
              {...tab}
              isActive={isTabActive(pathname, tab.href)}
              onNavigate={handleNavigate}
            />
          ))}
        </div>

        {showStatsCenter ? (
          <StatsCenterButton
            isActive={statsActive}
            onNavigate={handleNavigate}
          />
        ) : null}

        <div className='flex min-w-0 flex-1'>
          {RIGHT_TABS.map((tab) => (
            <TabButton
              key={tab.href}
              {...tab}
              isActive={isTabActive(pathname, tab.href)}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
