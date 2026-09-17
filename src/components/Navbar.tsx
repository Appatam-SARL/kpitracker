'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { sidebarItems } from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { hasGroupCompanyScopeFrontend } from '@/lib/roles';
import { BookOpen, LogOut, Settings, User, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ComponentType } from 'react';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Titres hors sidebar (profil, etc.). */
const EXTRA_MENU_TITLES: { href: string; label: string }[] = [
  { href: '/profile', label: 'Profil' },
];

/** Libellé du menu correspondant à la route courante. */
export function getMenuLabelForPath(pathname: string): string {
  const entries = [...sidebarItems, ...EXTRA_MENU_TITLES].sort(
    (a, b) => b.href.length - a.href.length,
  );

  for (const item of entries) {
    const baseHref = item.href.split('?')[0];
    if (baseHref === '/') {
      if (pathname === '/') return item.label;
      continue;
    }
    if (pathname === baseHref || pathname.startsWith(`${baseHref}/`)) {
      return item.label;
    }
  }

  return 'KpiTracker';
}

type NavbarProps = {
  /** Si fourni, remplace le libellé du menu (ex. fiche détail). */
  title?: string;
  /** Description affichée juste sous le titre. */
  subtitle?: string;
  /** Icône à gauche du titre. */
  titleIcon?: ComponentType<{ className?: string }>;
};

export default function Navbar({ title, subtitle, titleIcon: TitleIcon }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const menuTitle = useMemo(
    () => getMenuLabelForPath(pathname ?? '/'),
    [pathname],
  );
  const displayTitle = title?.trim() || menuTitle;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('auth:changed'));
    router.push('/login');
  };

  const showCommercialesLink = hasGroupCompanyScopeFrontend(user?.role);
  const greeting = user ? `Bonjour, ${user.name}` : 'Bonjour';
  const description = subtitle?.trim() || null;

  return (
    <header className='hidden sm:flex items-center justify-between pb-4 bg-transparent'>
      <div className='flex min-w-0 items-start gap-3'>
        {TitleIcon ? (
          <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
            <TitleIcon className='h-5 w-5' />
          </span>
        ) : null}
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='text-xs text-gray-400 truncate'>{greeting}</span>
          <h1 className='text-lg md:text-2xl font-semibold text-primary truncate'>
            {displayTitle}
          </h1>
          {description ? (
            <p className='text-xs text-gray-500 md:whitespace-normal'>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {user && (
        <div className='flex items-center gap-3'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-neu hover:shadow-neu-soft transition-shadow focus:outline-none'
                title={`${user.name} ${user.role}`}
              >
                <span className='hidden sm:inline text-[11px] text-gray-600 truncate max-w-[120px]'>
                  {user.name}
                </span>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-neu'>
                  {getInitials(user.name)}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-[160px]'>
              <DropdownMenuItem onClick={() => router.push('/guide')}>
                <BookOpen className='w-4 h-4 mr-2' />
                Guide d&apos;utilisation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className='w-4 h-4 mr-2' />
                Profil
              </DropdownMenuItem>
              {showCommercialesLink && (
                <DropdownMenuItem
                  onClick={() => router.push('/users?role=agent')}
                >
                  <Users className='w-4 h-4 mr-2' />
                  Commerciales
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className='w-4 h-4 mr-2' />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className='text-rose-600 focus:text-rose-600'
              >
                <LogOut className='w-4 h-4 mr-2' />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
