'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { hasGroupCompanyScopeFrontend } from '@/lib/roles';
import { BookOpen, LogOut, Search, Settings, User, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

type NavbarProps = {
  title?: string;
  subtitle?: string;
};

export default function Navbar({
  title = "Vue d'ensemble KpiTracker",
  subtitle,
}: NavbarProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('auth:changed'));
    router.push('/login');
  };

  const showCommercialesLink = hasGroupCompanyScopeFrontend(user?.role);
  const greeting = subtitle ?? (user ? `Bonjour, ${user.name}` : 'Bonjour');

  return (
    <header className='hidden sm:flex items-center justify-between pb-4 bg-transparent'>
      <div className='flex min-w-0 flex-col gap-1'>
        <span className='text-xs text-gray-400 truncate'>{greeting}</span>
        <h1 className='text-lg md:text-2xl font-semibold text-primary truncate'>
          {title}
        </h1>
      </div>

      <div className='flex items-center gap-3'>
        <div className='hidden md:flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-neu text-xs text-gray-400 w-[min(100%,220px)] max-w-[220px] shrink'>
          <Search className='w-4 h-4 shrink-0' />
          <input
            placeholder='Rechercher…'
            className='bg-transparent outline-none flex-1 min-w-0 text-[11px]'
          />
        </div>
        {user && (
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
        )}
      </div>
    </header>
  );
}
