export const TRASH_ENTITY_TYPES = [
  'LEAD',
  'USER',
  'GOAL',
  'ATTACHMENT',
] as const;

export type TrashEntityType = (typeof TRASH_ENTITY_TYPES)[number];

export type TrashItemDto = {
  id: string;
  entityType: TrashEntityType;
  label: string;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
  companyId: string;
  companyName?: string;
  metadata?: Record<string, unknown>;
};

export const TRASH_ENTITY_LABELS: Record<TrashEntityType, string> = {
  LEAD: 'Prospect',
  USER: 'Utilisateur',
  GOAL: 'Objectif',
  ATTACHMENT: 'Pièce jointe',
};

export function isTrashEntityType(value: string): value is TrashEntityType {
  return (TRASH_ENTITY_TYPES as readonly string[]).includes(value);
}

export const activeOnlyWhere = { deletedAt: null } as const;

export const trashedOnlyWhere = {
  deletedAt: { not: null },
} as const;
