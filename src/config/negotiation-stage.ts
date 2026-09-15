export const NEGOTIATION_STAGE_VALUES = [
  'EN_PROSPECTION',
  'VENTE_CONCLUE',
  'VENTE_PERDUE',
] as const;

export type NegotiationStageValue =
  (typeof NEGOTIATION_STAGE_VALUES)[number];

export const NEGOTIATION_STAGE_OPTIONS = [
  { value: 'EN_PROSPECTION', label: 'En prospection' },
  { value: 'VENTE_CONCLUE', label: 'Vente conclue' },
  { value: 'VENTE_PERDUE', label: 'Vente perdue' },
] as const;

export const NEGOTIATION_STAGE_LABELS: Record<NegotiationStageValue, string> = {
  EN_PROSPECTION: 'En prospection',
  VENTE_CONCLUE: 'Vente conclue',
  VENTE_PERDUE: 'Vente perdue',
};

export const NEGOTIATION_STAGE_STYLES: Record<NegotiationStageValue, string> = {
  EN_PROSPECTION: 'bg-blue-100 text-blue-700 border border-blue-200',
  VENTE_CONCLUE: 'bg-teal-100 text-teal-700 border border-teal-200',
  VENTE_PERDUE: 'bg-rose-100 text-rose-700 border border-rose-200',
};

export const NEGOTIATION_STAGE_ORDER: NegotiationStageValue[] = [
  'EN_PROSPECTION',
  'VENTE_CONCLUE',
  'VENTE_PERDUE',
];

/** Libellé UI du champ (fiche contact / pipeline). */
export const NEGOTIATION_STAGE_FIELD_LABEL = 'Stade de négociation';

export function formatNegotiationStageLabel(
  value: string | null | undefined,
): string {
  if (!value) return NEGOTIATION_STAGE_LABELS.EN_PROSPECTION;
  return (
    NEGOTIATION_STAGE_LABELS[value as NegotiationStageValue] ?? value
  );
}

export function isNegotiationStage(
  value: string | null | undefined,
): value is NegotiationStageValue {
  return (
    !!value &&
    (NEGOTIATION_STAGE_VALUES as readonly string[]).includes(value)
  );
}

/** Anciens LeadStatus → nouveau stade (compat lectures / imports). */
export function mapLegacyLeadStatusToNegotiationStage(
  status: string | null | undefined,
): NegotiationStageValue {
  switch (status) {
    case 'CONVERTED':
    case 'VENTE_CONCLUE':
      return 'VENTE_CONCLUE';
    case 'LOST':
    case 'VENTE_PERDUE':
      return 'VENTE_PERDUE';
    default:
      return 'EN_PROSPECTION';
  }
}
