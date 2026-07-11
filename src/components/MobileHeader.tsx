'use client';

import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel, hasGroupCompanyScopeFrontend, normalizeFrontendRole } from '@/lib/roles';
import {
  getSecondaryNavItemsForRole,
  type SidebarItemDef,
} from '@/components/Sidebar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Bell, Menu, User, Users, X } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export const MOBILE_HEADER_OFFSET =
  'pt-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:pt-0';

const PROFILE_NAV_ITEM: SidebarItemDef = {
  icon: User,
  label: 'Profil',
  href: '/profile',
};

const COMMERCIALES_NAV_ITEM: SidebarItemDef = {
  icon: Users,
  label: 'Commerciales',
  href: '/users?role=agent',
};

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  const baseHref = href.split('?')[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function roleLabel(role: string | undefined): string {
  if (!role) return '';
  const normalized = normalizeFrontendRole(role);
  if (normalized === 'admin') return 'Administrateur';
  return getRoleLabel(normalized);
}

export default function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'Profil';

  const secondaryItems = useMemo(() => {
    const items = getSecondaryNavItemsForRole(user?.role ?? null);
    const withProfile = items.some((i) => i.href === '/profile')
      ? items
      : [...items, PROFILE_NAV_ITEM];
    if (
      hasGroupCompanyScopeFrontend(user?.role) &&
      !withProfile.some((i) => i.href.startsWith('/users'))
    ) {
      return [...withProfile, COMMERCIALES_NAV_ITEM];
    }
    return withProfile;
  }, [user?.role]);

  const handleNavigate = (href: string) => {
    setMenuOpen(false);
    if (href && href !== pathname) {
      router.push(href);
    }
  };

  return (
    <header
      className='fixed top-0 left-0 right-0 z-40 sm:hidden'
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className='flex items-center justify-between gap-3 border-b border-gray-200/80 bg-[#F7F7F7] px-4 py-3'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <button
              type='button'
              onClick={() => setMenuOpen(true)}
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-700 shadow-neu-soft transition-colors hover:bg-gray-50'
              aria-label='Ouvrir le menu de navigation'
            >
              <Menu className='h-5 w-5' strokeWidth={1.75} />
            </button>

            <SheetContent
              aria-describedby={undefined}
              className='inset-y-0 left-0 right-auto flex h-full w-[min(85vw,300px)] max-w-none flex-col gap-0 border-r border-gray-200/80 border-l-0 px-0 py-0'
            >
              <SheetHeader className='border-b border-gray-100 bg-[#F7F7F7] px-4 py-4 text-left'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <SheetTitle className='text-base font-bold text-primary'>
                      Navigation
                    </SheetTitle>
                    <SheetDescription className='mt-1 text-[11px]'>
                      {user?.name ?? 'Mon compte'}
                      {user?.role ? ` · ${roleLabel(user.role)}` : ''}
                    </SheetDescription>
                  </div>
                  <button
                    type='button'
                    onClick={() => setMenuOpen(false)}
                    className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-500 shadow-neu-soft hover:text-primary'
                    aria-label='Fermer le menu'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </SheetHeader>

              <nav
                className='flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4'
                aria-label='Menus secondaires'
              >
                {secondaryItems.length === 0 ? (
                  <p className='px-2 text-[11px] text-gray-500'>
                    Aucun menu supplémentaire pour votre rôle.
                  </p>
                ) : (
                  secondaryItems.map((item) => {
                    const isActive = isNavItemActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        type='button'
                        onClick={() => handleNavigate(item.href)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-white shadow-neu-soft'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? 'text-white' : 'text-sky-600'
                          }`}
                          strokeWidth={1.75}
                        />
                        <span className='truncate'>{item.label}</span>
                      </button>
                    );
                  })
                )}
              </nav>

              <div className='border-t border-gray-100 px-4 py-3 text-[10px] text-gray-400'>
                Les raccourcis principaux sont dans la barre du bas.
              </div>
            </SheetContent>
          </Sheet>

          <button
            type='button'
            onClick={() => router.push('/')}
            className='flex min-w-0 items-center gap-2.5'
            aria-label='Accueil KpiTracker'
          >
            <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white shadow-neu-soft'>
              <Image
                src='/kpitracker-mark.svg'
                alt=''
                width={28}
                height={28}
                className='h-7 w-7'
              />
            </span>
            <span className='truncate text-base font-bold tracking-tight text-primary'>
              KpiTracker
            </span>
          </button>
        </div>

        <div className='flex shrink-0 items-center gap-2.5'>
          {/* <button
            type='button'
            onClick={() => router.push('/leads')}
            className='flex h-9 w-9 items-center justify-center text-gray-600 transition-colors hover:text-primary'
            aria-label='Leads'
          >
            <ShoppingBag className='h-5 w-5' strokeWidth={1.75} />
          </button> */}
          <button
            type='button'
            className='relative flex h-9 w-9 items-center justify-center text-gray-600 transition-colors hover:text-primary'
            aria-label='Notifications'
          >
            <Bell className='h-5 w-5' strokeWidth={1.75} />
          </button>
          <button
            type='button'
            onClick={() => router.push('/profile')}
            className='rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-gray-800 shadow-neu-soft transition-transform active:scale-[0.98] hover:bg-gray-50'
          >
            {firstName.length > 10 ? `${firstName.slice(0, 9)}…` : firstName}
          </button>
        </div>
      </div>
    </header>
  );
}
