'use client';

import { motion } from 'framer-motion';
import {
  Building2,
  Eye,
  MoreHorizontal,
  Pencil,
  Phone,
  UserRound,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ClientCardData = {
  id: string;
  name: string;
  contact?: string | null;
  totalRevenue: number;
  phone?: string | null;
  companyName?: string | null;
  company?: { id: string; name: string } | null;
  convertedBy?: { id: string; name: string } | null;
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'CL';
}

function formatCa(amount: number) {
  return amount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  });
}

type ClientCardProps = {
  client: ClientCardData;
  onView: () => void;
  onEdit: () => void;
};

export default function ClientCard({ client, onView, onEdit }: ClientCardProps) {
  const phone = client.phone?.trim() || client.contact?.trim() || null;
  const company =
    client.company?.name?.trim() || client.companyName?.trim() || null;
  const convertedBy = client.convertedBy?.name?.trim() || null;
  const hasRevenue = client.totalRevenue > 0;

  return (
    <motion.article
      role='button'
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
      className='group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-white/70 bg-white/95 p-3.5 shadow-neu-soft outline-none transition-all hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-neu focus-visible:ring-2 focus-visible:ring-primary/30'
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary text-[11px] font-semibold text-white shadow-neu-soft'>
            {initialsFrom(client.name)}
          </div>
          <div className='flex min-w-0 flex-col gap-0.5'>
            <h3 className='truncate text-[13px] font-semibold leading-snug text-primary'>
              {client.name}
            </h3>
            <span className='inline-flex w-fit items-center rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700'>
              Client
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              aria-label='Actions client'
              onClick={(e) => e.stopPropagation()}
              className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-500 opacity-80 transition-opacity hover:bg-white hover:text-primary group-hover:opacity-100'
            >
              <MoreHorizontal className='h-3.5 w-3.5' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side='left'
            align='end'
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onView();
              }}
            >
              <Eye className='mr-2 h-4 w-4' />
              Voir
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEdit();
              }}
            >
              <Pencil className='mr-2 h-4 w-4' />
              Modifier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex flex-col gap-1.5 text-[11px] text-gray-600'>
        {phone ? (
          <p className='inline-flex min-w-0 items-center gap-1.5'>
            <Phone className='h-3 w-3 shrink-0 text-gray-400' />
            <span className='truncate text-gray-700'>{phone}</span>
          </p>
        ) : (
          <p className='inline-flex items-center gap-1.5 text-gray-400'>
            <Phone className='h-3 w-3 shrink-0' />
            Aucun téléphone
          </p>
        )}

        <p className='inline-flex min-w-0 items-center gap-1.5'>
          <Building2 className='h-3 w-3 shrink-0 text-gray-400' />
          <span className='truncate font-medium text-gray-700'>
            {company ?? 'Société non renseignée'}
          </span>
        </p>

        <p className='inline-flex min-w-0 items-center gap-1.5'>
          <UserRound className='h-3 w-3 shrink-0 text-gray-400' />
          <span className='truncate'>
            Converti par{' '}
            <span className='font-medium text-gray-700'>
              {convertedBy ?? '—'}
            </span>
          </span>
        </p>
      </div>

      <div className='mt-auto flex items-end justify-between gap-2 border-t border-gray-100/80 pt-2.5'>
        <div className='min-w-0'>
          <p className='text-[9px] font-medium uppercase tracking-wide text-gray-400'>
            CA total
          </p>
          <p
            className={`truncate text-[13px] font-semibold tabular-nums ${
              hasRevenue ? 'text-primary' : 'text-gray-400'
            }`}
          >
            {formatCa(client.totalRevenue)}
          </p>
        </div>
        <span className='shrink-0 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100'>
          Voir →
        </span>
      </div>
    </motion.article>
  );
}
