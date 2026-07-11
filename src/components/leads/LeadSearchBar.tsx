'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DEFAULT_LEAD_SEARCH_FIELDS,
  LEAD_SEARCH_FIELDS,
  type LeadSearchFieldId,
  buildSearchPlaceholder,
} from '@/lib/lead-search';
import { Search, SlidersHorizontal } from 'lucide-react';

type LeadSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  searchFields: LeadSearchFieldId[];
  onSearchFieldsChange: (fields: LeadSearchFieldId[]) => void;
};

export default function LeadSearchBar({
  query,
  onQueryChange,
  searchFields,
  onSearchFieldsChange,
}: LeadSearchBarProps) {
  const toggleField = (fieldId: LeadSearchFieldId) => {
    if (searchFields.includes(fieldId)) {
      const next = searchFields.filter((id) => id !== fieldId);
      onSearchFieldsChange(
        next.length > 0 ? next : [...DEFAULT_LEAD_SEARCH_FIELDS],
      );
      return;
    }
    onSearchFieldsChange([...searchFields, fieldId]);
  };

  const selectAll = () => {
    onSearchFieldsChange(LEAD_SEARCH_FIELDS.map((f) => f.id));
  };

  const resetDefault = () => {
    onSearchFieldsChange([...DEFAULT_LEAD_SEARCH_FIELDS]);
  };

  const activeCount = searchFields.length;
  const totalCount = LEAD_SEARCH_FIELDS.length;

  return (
    <div className='flex w-full min-w-0 items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs'>
      <Search className='h-4 w-4 shrink-0 text-gray-400' />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={buildSearchPlaceholder(searchFields)}
        disabled={searchFields.length === 0}
        className='min-w-0 flex-1 bg-transparent text-[11px] text-gray-700 outline-none disabled:cursor-not-allowed disabled:text-gray-400'
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
            aria-label='Critères de recherche'
            title='Critères de recherche'
          >
            <SlidersHorizontal className='h-3.5 w-3.5' />
            {activeCount < totalCount && (
              <span className='absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-white'>
                {activeCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='w-60 p-2'
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <p className='px-2 pb-1 text-[10px] font-medium text-gray-500'>
            Champs concernés par la recherche
          </p>
          <div
            className='max-h-56 overflow-y-auto'
            onPointerDown={(e) => e.stopPropagation()}
          >
            {LEAD_SEARCH_FIELDS.map((field) => {
              const checked = searchFields.includes(field.id);
              return (
                <label
                  key={field.id}
                  className='flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50'
                >
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={() => toggleField(field.id)}
                    className='h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-primary focus:ring-primary/30'
                  />
                  <span className='flex-1'>{field.label}</span>
                </label>
              );
            })}
          </div>
          <div className='mt-1 flex gap-1 border-t border-gray-100 pt-2'>
            <button
              type='button'
              onClick={selectAll}
              className='flex-1 rounded-lg px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50'
            >
              Tout sélectionner
            </button>
            <button
              type='button'
              onClick={resetDefault}
              className='flex-1 rounded-lg px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50'
            >
              Par défaut
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
