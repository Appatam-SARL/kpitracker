import {
  DEFAULT_LEAD_TYPES,
  LEAD_TYPE_OPTIONS,
  formatLeadTypeLabel,
  type LeadTypeLabel,
  type LeadTypeValue,
} from '@/config/lead-options';
import type { LeadTypeClient } from '@prisma/client';

export { DEFAULT_LEAD_TYPES, LEAD_TYPE_OPTIONS, formatLeadTypeLabel };

const LABEL_BY_VALUE = Object.fromEntries(
  LEAD_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<LeadTypeValue, LeadTypeLabel>;

function normalizeLeadTypeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Convertit un libellé Excel / UI (ou une valeur enum) en LeadTypeClient.
 * Retourne null si la valeur est vide ; undefined si non reconnue.
 */
export function parseLeadType(
  raw: string | null | undefined,
): LeadTypeClient | null | undefined {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const asEnum = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (asEnum in LABEL_BY_VALUE) {
    return asEnum as LeadTypeClient;
  }

  const key = normalizeLeadTypeKey(trimmed);
  const byLabel = LEAD_TYPE_OPTIONS.find(
    (option) => normalizeLeadTypeKey(option.label) === key,
  );
  if (byLabel) return byLabel.value as LeadTypeClient;

  const aliases: Record<string, LeadTypeClient> = {
    b2c: 'PARTICULIER_B2C',
    particulier: 'PARTICULIER_B2C',
    b2b: 'ENTREPRISE_PRIVEE_B2B',
    entrepriseprivee: 'ENTREPRISE_PRIVEE_B2B',
    collectivite: 'COLLECTIVITE_TERRITORIALE',
    collectiviteterritoriale: 'COLLECTIVITE_TERRITORIALE',
    gouvernement: 'GOUVERNEMENT_SECTEUR_PUBLIC',
    gouvernementsecteurpublic: 'GOUVERNEMENT_SECTEUR_PUBLIC',
    hotels: 'HOTELS_ET_ESPACES_EVENEMENTIEL',
    hotelsetespacesevenementiel: 'HOTELS_ET_ESPACES_EVENEMENTIEL',
    oi: 'INSTITUTION_MULTILATERALE_OI',
    institutionmultilaterale: 'INSTITUTION_MULTILATERALE_OI',
    ifi: 'INSTITUTION_FINANCIERE_INTERNATIONALE_IFI',
    institutionfinanciereinternationale:
      'INSTITUTION_FINANCIERE_INTERNATIONALE_IFI',
    agencedecooperation: 'AGENCE_DE_COOPERATION_OPERATEUR',
    agencedecooperationoperateur: 'AGENCE_DE_COOPERATION_OPERATEUR',
    ong: 'ONG_ASSOCIATION_ACADEMIQUE',
    ongassociationacademique: 'ONG_ASSOCIATION_ACADEMIQUE',
    nondetermine: 'NON_DETERMINE',
  };
  if (key in aliases) return aliases[key];

  return undefined;
}
