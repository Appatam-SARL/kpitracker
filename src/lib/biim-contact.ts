import {
  normalizeBiimDocuments,
  isBiimCompanyName,
  parseBiimYesNo,
} from '@/config/biim-contact-fields';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const biimContactFieldsSchema = z.object({
  biimDocuments: z.array(z.string()).optional().nullable(),
  /** @deprecated compat ancienne API mono-document */
  biimDocument: z.string().optional().nullable(),
  biimRegistered: z.union([z.boolean(), z.string()]).optional().nullable(),
  biimVisited: z.union([z.boolean(), z.string()]).optional().nullable(),
  biimApproved: z.union([z.boolean(), z.string()]).optional().nullable(),
});

export async function userBelongsToBiim(
  companyId: string | null | undefined,
): Promise<boolean> {
  if (!companyId) return false;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, kind: true },
  });
  if (!company || company.kind !== 'GROUP') return false;
  return isBiimCompanyName(company.name);
}

export function resolveBiimContactData(
  input: z.infer<typeof biimContactFieldsSchema> | undefined,
  isBiimUser: boolean,
  mode: 'create' | 'update' = 'create',
): {
  biimDocuments?: Prisma.InputJsonValue;
  biimRegistered?: boolean | null;
  biimVisited?: boolean | null;
  biimApproved?: boolean | null;
} {
  if (!isBiimUser || !input) return {};

  const pickDocs = (): string[] | undefined => {
    if (input.biimDocuments !== undefined) {
      return normalizeBiimDocuments(input.biimDocuments);
    }
    if (input.biimDocument !== undefined) {
      return normalizeBiimDocuments(
        input.biimDocument ? [input.biimDocument] : [],
      );
    }
    return mode === 'create' ? [] : undefined;
  };

  const pickBool = (value: unknown) => {
    if (value === undefined) return mode === 'create' ? null : undefined;
    return parseBiimYesNo(value) ?? null;
  };

  const docs = pickDocs();

  return {
    biimDocuments:
      docs === undefined
        ? undefined
        : (docs as unknown as Prisma.InputJsonValue),
    biimRegistered: pickBool(input.biimRegistered),
    biimVisited: pickBool(input.biimVisited),
    biimApproved: pickBool(input.biimApproved),
  };
}
