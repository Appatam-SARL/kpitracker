'use client';

import { GROUP_HOLDING_SCOPE_VALUE } from '@/lib/group-scope-roles';
import type { GroupCompanyOption } from '@/hooks/useGroupCompanyScope';

type GroupCompanySelectProps = {
  id?: string;
  label?: string;
  value: string;
  options: GroupCompanyOption[];
  fallbackOption?: GroupCompanyOption;
  onChange: (companyId: string) => void;
  className?: string;
  selectClassName?: string;
  /** Si true, ajoute l'option « ma société » vide (stats / rapports). */
  includeDefaultScopeOption?: boolean;
  /** Stats groupe : agrégation sur toutes les entreprises kind GROUP. */
  includeHoldingOption?: boolean;
};

export default function GroupCompanySelect({
  id = 'group-company',
  label = 'Entreprise',
  value,
  options,
  fallbackOption,
  onChange,
  className = '',
  selectClassName = 'rounded-lg border border-gray-200 px-2 py-1.5 text-xs w-full sm:w-auto min-w-[180px]',
  includeDefaultScopeOption = false,
  includeHoldingOption = false,
}: GroupCompanySelectProps) {
  return (
    <div className={`flex flex-col gap-1 min-w-[180px] ${className}`}>
      <label className='text-[11px] text-gray-500' htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {includeDefaultScopeOption && (
          <option value=''>Périmètre par défaut (ma société)</option>
        )}
        {includeHoldingOption && (
          <option value={GROUP_HOLDING_SCOPE_VALUE}>Holding</option>
        )}
        {options.length === 0 && fallbackOption ? (
          <option value={fallbackOption.id}>{fallbackOption.name}</option>
        ) : (
          options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
