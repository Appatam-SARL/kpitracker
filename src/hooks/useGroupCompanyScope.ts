'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasGroupCompanyScopeFrontend } from '@/lib/roles';
import { isGroupHoldingScopeValue } from '@/lib/group-scope-roles';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type GroupCompanyOption = { id: string; name: string };

type UseGroupCompanyScopeOptions = {
  /** Id entreprise initiale (ex. société rattachée de l'utilisateur). */
  initialCompanyId?: string;
};

export function useGroupCompanyScope(options: UseGroupCompanyScopeOptions = {}) {
  const { user: authUser } = useAuth();
  const hasGroupScope = hasGroupCompanyScopeFrontend(authUser?.role);

  const [companyOptions, setCompanyOptions] = useState<GroupCompanyOption[]>(
    [],
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    options.initialCompanyId ?? authUser?.company?.id ?? '',
  );

  useEffect(() => {
    if (!hasGroupScope) return;
    if (!selectedCompanyId && authUser?.company?.id) {
      setSelectedCompanyId(authUser.company.id);
    }
  }, [hasGroupScope, selectedCompanyId, authUser?.company?.id]);

  useEffect(() => {
    if (!hasGroupScope) return;

    const load = async () => {
      try {
        const res = await fetch('/api/companies/group', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const mapped = data.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }));
        setCompanyOptions(mapped);

        if (
          mapped.length > 0 &&
          selectedCompanyId &&
          !isGroupHoldingScopeValue(selectedCompanyId) &&
          !mapped.some((c) => c.id === selectedCompanyId)
        ) {
          const fallback =
            authUser?.company?.id &&
            mapped.some((c) => c.id === authUser.company?.id)
              ? authUser.company.id
              : mapped[0].id;
          setSelectedCompanyId(fallback);
        }
      } catch {
        // silencieux
      }
    };

    void load();
  }, [hasGroupScope, authUser?.company?.id]);

  const scopeLabel = useMemo(() => {
    if (!hasGroupScope) {
      return authUser?.company?.name ?? 'Ma société';
    }
    if (isGroupHoldingScopeValue(selectedCompanyId)) {
      return 'Holding (toutes les entreprises du groupe)';
    }
    if (!selectedCompanyId.trim()) {
      return 'Périmètre par défaut (ma société)';
    }
    return (
      companyOptions.find((c) => c.id === selectedCompanyId)?.name ??
      authUser?.company?.name ??
      'Entreprise sélectionnée'
    );
  }, [
    hasGroupScope,
    selectedCompanyId,
    companyOptions,
    authUser?.company?.name,
  ]);

  const apiCompanyId = useMemo(() => {
    if (!hasGroupScope || !selectedCompanyId.trim()) return undefined;
    return selectedCompanyId.trim();
  }, [hasGroupScope, selectedCompanyId]);

  const resetCompanySelection = useCallback(() => {
    setSelectedCompanyId(authUser?.company?.id ?? '');
  }, [authUser?.company?.id]);

  return {
    hasGroupScope,
    companyOptions,
    selectedCompanyId,
    setSelectedCompanyId,
    resetCompanySelection,
    scopeLabel,
    apiCompanyId,
  };
}
