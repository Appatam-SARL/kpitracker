'use client';

import {
  getActivityDomainsForSector,
  getActivitySectorLetter,
} from '@/config/lead-options';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

type ActivityDomainsChecklistProps = {
  selected: string[];
  onChange: (domains: string[]) => void;
  /** Secteur CIAP sélectionné — filtre les domaines (ex. C → C10…C33). */
  activitySector?: string | null;
};

export default function ActivityDomainsChecklist({
  selected,
  onChange,
  activitySector,
}: ActivityDomainsChecklistProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const sectorLetter = getActivitySectorLetter(activitySector);
  const sectorDomains = useMemo(
    () => getActivityDomainsForSector(activitySector),
    [activitySector],
  );

  // Retire les domaines hors secteur quand le secteur change
  useEffect(() => {
    if (!sectorLetter) {
      if (selected.length > 0) onChange([]);
      return;
    }
    const allowed = new Set(sectorDomains);
    const next = selected.filter((d) => allowed.has(d));
    if (next.length !== selected.length) onChange(next);
  }, [sectorLetter, sectorDomains, selected, onChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...sectorDomains];
    return sectorDomains.filter((domain) => domain.toLowerCase().includes(q));
  }, [query, sectorDomains]);

  const toggleDomain = (domain: string) => {
    if (selected.includes(domain)) {
      onChange(selected.filter((d) => d !== domain));
      return;
    }
    onChange([...selected, domain]);
  };

  const removeDomain = (domain: string) => {
    onChange(selected.filter((d) => d !== domain));
  };

  return (
    <div className='flex flex-col gap-1.5'>
      <label className='text-[11px] font-medium text-gray-600' htmlFor={listId}>
        Domaines d&apos;activités (CIAP)
      </label>

      {!sectorLetter ? (
        <p className='rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-500'>
          Choisissez d&apos;abord un secteur d&apos;activités pour afficher les
          domaines correspondants.
        </p>
      ) : (
        <>
          <p className='text-[10px] text-gray-400'>
            Domaines du secteur {sectorLetter} — cochez un ou plusieurs.
          </p>

          {selected.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {selected.map((domain) => (
                <span
                  key={domain}
                  className='inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary'
                >
                  <span className='truncate'>{domain}</span>
                  <button
                    type='button'
                    onClick={() => removeDomain(domain)}
                    className='rounded p-0.5 text-primary/60 hover:bg-primary/10 hover:text-primary'
                    aria-label={`Retirer ${domain}`}
                  >
                    <X className='h-3 w-3' />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className='flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5'>
            <Search className='h-3.5 w-3.5 shrink-0 text-gray-400' aria-hidden />
            <input
              id={listId}
              type='search'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Rechercher un domaine…'
              className='min-w-0 flex-1 border-0 bg-transparent text-[11px] text-gray-700 placeholder:text-gray-400 focus:outline-none'
              autoComplete='off'
            />
          </div>

          <div className='max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-gray-100 bg-white p-1.5'>
            {filtered.length === 0 ? (
              <p className='px-2 py-3 text-[10px] text-gray-400'>
                Aucun domaine ne correspond à la recherche.
              </p>
            ) : (
              filtered.map((domain) => {
                const checked = selected.includes(domain);
                return (
                  <label
                    key={domain}
                    className='flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50'
                  >
                    <input
                      type='checkbox'
                      checked={checked}
                      onChange={() => toggleDomain(domain)}
                      className='mt-0.5'
                    />
                    <span>{domain}</span>
                  </label>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
