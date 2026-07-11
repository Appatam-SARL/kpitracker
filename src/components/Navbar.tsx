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
import Image from 'next/image';
import { useRouter } from 'next/navigation';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Navbar() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('auth:changed'));
    router.push('/login');
  };

  const showCommercialesLink = hasGroupCompanyScopeFrontend(user?.role);

  return (
    <header className='hidden sm:flex items-center justify-between pb-4 bg-transparent'>
      <div className='flex items-start gap-3'>
        <Image
          src='/kpitracker-mark.svg'
          alt=''
          width={36}
          height={36}
          className='hidden sm:block h-9 w-9 shrink-0 mt-0.5 drop-shadow-sm'
        />
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-gray-400'>
            {user ? `Bonjour, ${user.name}` : 'Bonjour'}
          </span>
          <h1 className='text-lg md:text-2xl font-semibold text-primary'>
            Vue d&apos;ensemble KpiTracker
          </h1>
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <div className='hidden md:flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-neu text-xs text-gray-400 min-w-[180px]'>
          <Search className='w-4 h-4' />
          <input
            placeholder='Rechercher un client, un lead...'
            className='bg-transparent outline-none flex-1 text-[11px]'
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
                <div className='w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 shadow-neu flex items-center justify-center text-white text-xs font-semibold shrink-0'>
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
