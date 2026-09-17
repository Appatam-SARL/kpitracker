'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = fr,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn('p-2', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'space-y-3',
        month_caption: 'relative flex h-8 items-center justify-center',
        caption_label: 'text-[12px] font-semibold capitalize text-gray-800',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-0.5',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-7 w-7 p-0 text-gray-500 hover:bg-gray-50 hover:text-primary',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-7 w-7 p-0 text-gray-500 hover:bg-gray-50 hover:text-primary',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-8 text-center text-[10px] font-medium uppercase text-gray-400',
        week: 'mt-1 flex w-full',
        day: 'relative h-8 w-8 p-0 text-center text-[11px]',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal text-gray-700 hover:bg-primary/10 hover:text-primary aria-selected:opacity-100',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary [&>button]:hover:text-white',
        today: '[&>button]:bg-primary/10 [&>button]:text-primary [&>button]:font-semibold',
        outside: '[&>button]:text-gray-300 [&>button]:opacity-60',
        disabled: '[&>button]:text-gray-300 [&>button]:opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
