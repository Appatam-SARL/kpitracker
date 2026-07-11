'use client';

import { sanitizeActivityDomain } from '@/lib/lead-activity-domains';
import { Search, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

type ActivityDomainsChecklistProps = {
  selected: string[];
  onChange: (domains: string[]) => void;
};

export default function ActivityDomainsChecklist({
  selected,
  onChange,
}: ActivityDomainsChecklistProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const addDomain = (raw: string) => {
    const value = sanitizeActivityDomain(raw);
    if (!value) return;
    if (selected.some((d) => d.toLowerCase() === value.toLowerCase())) return;
    onChange([...selected, value]);
    setQuery('');
  };

  const removeDomain = (domain: string) => {
    onChange(selected.filter((d) => d !== domain));
  };

  const commitQuery = () => {
    if (query.trim()) {
      addDomain(query);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitQuery();
      return;
    }

    if (e.key === 'Backspace' && !query && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  return (
    <div className='flex flex-col gap-1'>
      <label className='text-[11px] font-medium text-gray-600' htmlFor={listId}>
        Domaines d&apos;activités
      </label>
      <p className='text-[10px] text-gray-400'>
        Saisissez librement les domaines du prospect (Entrée ou virgule pour
        ajouter un tag).
      </p>

      <div
        className='flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary/40'
        onClick={() => inputRef.current?.focus()}
      >
        <Search className='h-3.5 w-3.5 shrink-0 text-gray-400' aria-hidden />

        {selected.map((domain) => (
          <span
            key={domain}
            className='inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 shadow-sm'
          >
            <span className='truncate'>{domain}</span>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                removeDomain(domain);
              }}
              className='rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              aria-label={`Retirer ${domain}`}
            >
              <X className='h-3 w-3' />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={listId}
          type='text'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={commitQuery}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? 'Ex : BTP, Santé, IT…' : ''}
          className='min-w-[120px] flex-1 border-0 bg-transparent px-0.5 py-0.5 text-[11px] text-gray-700 placeholder:text-gray-400 focus:outline-none'
          autoComplete='off'
        />
      </div>
    </div>
  );
}
