'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const HISTORY_MAX = 10;

function readHistory(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function writeHistory(storageKey: string, items: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(items.slice(0, HISTORY_MAX)),
    );
  } catch {
    // silencieux
  }
}

function pushHistory(storageKey: string, term: string): string[] {
  const normalized = term.trim();
  if (!normalized) return readHistory(storageKey);
  const next = [
    normalized,
    ...readHistory(storageKey).filter(
      (item) => item.toLowerCase() !== normalized.toLowerCase(),
    ),
  ].slice(0, HISTORY_MAX);
  writeHistory(storageKey, next);
  return next;
}

export type InstantSearchFieldOption = {
  id: string;
  label: string;
};

type InstantSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  storageKey: string;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
  /** Champs de recherche inclus/exclus (comme sur Contacts) */
  fieldOptions?: readonly InstantSearchFieldOption[];
  searchFields?: string[];
  onSearchFieldsChange?: (fields: string[]) => void;
  defaultSearchFields?: readonly string[];
};

export default function InstantSearchBar({
  query,
  onQueryChange,
  placeholder = 'Rechercher…',
  storageKey,
  disabled = false,
  trailing,
  className = '',
  fieldOptions,
  searchFields,
  onSearchFieldsChange,
  defaultSearchFields,
}: InstantSearchBarProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const hasFieldCriteria =
    Boolean(fieldOptions?.length) &&
    Array.isArray(searchFields) &&
    typeof onSearchFieldsChange === 'function';

  useEffect(() => {
    setHistory(readHistory(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const rememberQuery = useCallback(
    (value: string) => {
      const next = pushHistory(storageKey, value);
      setHistory(next);
    },
    [storageKey],
  );

  const toggleField = (fieldId: string) => {
    if (!hasFieldCriteria || !searchFields || !onSearchFieldsChange) return;
    if (searchFields.includes(fieldId)) {
      const next = searchFields.filter((id) => id !== fieldId);
      onSearchFieldsChange(
        next.length > 0
          ? next
          : [...(defaultSearchFields ?? fieldOptions!.map((f) => f.id))],
      );
      return;
    }
    onSearchFieldsChange([...searchFields, fieldId]);
  };

  const selectAllFields = () => {
    if (!hasFieldCriteria || !onSearchFieldsChange || !fieldOptions) return;
    onSearchFieldsChange(fieldOptions.map((f) => f.id));
  };

  const resetDefaultFields = () => {
    if (!hasFieldCriteria || !onSearchFieldsChange) return;
    onSearchFieldsChange([
      ...(defaultSearchFields ?? fieldOptions!.map((f) => f.id)),
    ]);
  };

  const suggestions = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((item) => item.toLowerCase().includes(q));
  })();

  const inputDisabled =
    disabled || (hasFieldCriteria && (searchFields?.length ?? 0) === 0);
  const showSuggestions = open && suggestions.length > 0 && !inputDisabled;

  const selectSuggestion = (term: string) => {
    onQueryChange(term);
    rememberQuery(term);
    setOpen(false);
  };

  const removeSuggestion = (term: string) => {
    const next = history.filter(
      (item) => item.toLowerCase() !== term.toLowerCase(),
    );
    writeHistory(storageKey, next);
    setHistory(next);
  };

  const activeCount = searchFields?.length ?? 0;
  const totalCount = fieldOptions?.length ?? 0;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <div className='flex w-full min-w-0 items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs focus-within:border-primary/20 focus-within:bg-white focus-within:shadow-neu-soft'>
        <Search className='h-4 w-4 shrink-0 text-gray-400' />
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setHistory(readHistory(storageKey));
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              rememberQuery(query);
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                if (query.trim()) rememberQuery(query);
              }
            }, 120);
          }}
          placeholder={placeholder}
          disabled={inputDisabled}
          role='combobox'
          aria-expanded={showSuggestions}
          aria-controls={listId}
          aria-autocomplete='list'
          className='min-w-0 flex-1 bg-transparent text-[11px] text-gray-700 outline-none disabled:cursor-not-allowed disabled:text-gray-400'
        />
        {query ? (
          <button
            type='button'
            onClick={() => {
              onQueryChange('');
              setOpen(true);
            }}
            className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-gray-600'
            aria-label='Effacer la recherche'
          >
            <X className='h-3.5 w-3.5' />
          </button>
        ) : null}
        {hasFieldCriteria ? (
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
                {fieldOptions!.map((field) => {
                  const checked = searchFields!.includes(field.id);
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
                  onClick={selectAllFields}
                  className='flex-1 rounded-lg px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50'
                >
                  Tout sélectionner
                </button>
                <button
                  type='button'
                  onClick={resetDefaultFields}
                  className='flex-1 rounded-lg px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50'
                >
                  Par défaut
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {trailing}
      </div>

      {showSuggestions ? (
        <div
          id={listId}
          role='listbox'
          className='absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-neu'
        >
          <p className='border-b border-gray-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-400'>
            Recherches récentes
          </p>
          <ul className='max-h-64 overflow-y-auto py-1'>
            {suggestions.map((term) => (
              <li key={term} className='group flex items-center'>
                <button
                  type='button'
                  role='option'
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(term)}
                  className='flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-50'
                >
                  <Search className='h-3.5 w-3.5 shrink-0 text-gray-400' />
                  <span className='truncate'>{term}</span>
                </button>
                <button
                  type='button'
                  aria-label={`Supprimer « ${term} » de l’historique`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => removeSuggestion(term)}
                  className='mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-500 group-hover:opacity-100'
                >
                  <X className='h-3 w-3' />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
