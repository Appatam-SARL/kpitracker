'use client';

import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';

export type AgendaView = 'jour' | 'semaine' | 'mois' | 'année' | 'période';

export interface CustomPeriod {
  start: Date;
  end: Date;
}

interface AgendaViewFilterProps {
  value: AgendaView;
  onChange: (view: AgendaView) => void;
  /** Utilisé quand value === "période" : période personnalisée choisie par le commercial */
  customPeriod?: CustomPeriod;
  onCustomPeriodChange?: (period: CustomPeriod) => void;
}

const OPTIONS: { value: AgendaView; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'année', label: 'Année' },
  { value: 'période', label: 'Période' },
];

/**
 * Bloc filtre de vue agenda : Jour | Semaine | Mois | Année | Période.
 * Avec l’option "Période", le commercial définit une date de début et une date de fin.
 */
export default function AgendaViewFilter({
  value,
  onChange,
  customPeriod,
  onCustomPeriodChange,
}: AgendaViewFilterProps) {
  const startStr = customPeriod ? format(customPeriod.start, 'yyyy-MM-dd') : '';
  const endStr = customPeriod ? format(customPeriod.end, 'yyyy-MM-dd') : '';

  const handleStartChange = (iso: string) => {
    const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
    onCustomPeriodChange?.({
      start: d,
      end: customPeriod?.end ?? d,
    });
  };

  const handleEndChange = (iso: string) => {
    const d = iso ? new Date(`${iso}T23:59:59.999`) : new Date();
    onCustomPeriodChange?.({
      start: customPeriod?.start ?? d,
      end: d,
    });
  };

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-1 p-1 rounded-xl bg-gray-100/80 border border-gray-100'>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type='button'
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              value === opt.value
                ? 'bg-white text-primary shadow-neu-soft border border-white/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value === 'période' && customPeriod && onCustomPeriodChange && (
        <div className='flex flex-wrap items-center gap-3 rounded-xl bg-white/90 border border-gray-100 p-3'>
          <span className='text-[11px] font-medium text-gray-600'>Du</span>
          <DatePicker
            value={startStr}
            onChange={handleStartChange}
            max={endStr || undefined}
            allowClear={false}
            placeholder='Date de début'
            className='w-40'
            buttonClassName='rounded-lg text-xs'
          />
          <span className='text-[11px] font-medium text-gray-600'>au</span>
          <DatePicker
            value={endStr}
            onChange={handleEndChange}
            min={startStr || undefined}
            allowClear={false}
            placeholder='Date de fin'
            className='w-40'
            buttonClassName='rounded-lg text-xs'
          />
        </div>
      )}
    </div>
  );
}
