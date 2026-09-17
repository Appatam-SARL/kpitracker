'use client';

import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseIsoDate(value?: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const parsed = parse(value.trim(), 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : undefined;
}

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export type DatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  id?: string;
  disabled?: boolean;
  /** Date ISO min (yyyy-MM-dd) */
  min?: string;
  /** Date ISO max (yyyy-MM-dd) */
  max?: string;
  allowClear?: boolean;
};

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'Choisir une date',
  className,
  buttonClassName,
  id,
  disabled = false,
  min,
  max,
  allowClear = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);

  const label = selected
    ? format(selected, 'dd/MM/yyyy', { locale: fr })
    : placeholder;

  return (
    <div className={cn('w-full', className)}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type='button'
            disabled={disabled}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 text-left text-[11px] outline-none transition-colors',
              'hover:border-primary/30 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'text-primary' : 'text-gray-400',
              buttonClassName,
            )}
          >
            <CalendarIcon className='h-3.5 w-3.5 shrink-0 text-gray-400' />
            <span className='min-w-0 flex-1 truncate'>{label}</span>
            {allowClear && selected && !disabled ? (
              <span
                role='button'
                tabIndex={-1}
                aria-label='Effacer la date'
                className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }}
              >
                <X className='h-3 w-3' />
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          className='w-auto p-2'
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Calendar
            mode='single'
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(date ? toIsoDate(date) : '');
              setOpen(false);
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
