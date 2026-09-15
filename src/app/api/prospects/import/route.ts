import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import {
  displayProspectName,
  normalizeProspectName,
} from '@/lib/prospect-name';
import { prisma } from '@/lib/prisma';
import { validateAndNormalizeLeadImportLists } from '@/lib/lead-import-validation';
import { resolveImportNames } from '@/lib/lead-import-upsert';
import { excelRowNumber } from '@/lib/lead-import-validation';
import { resolveImportedLocationFields } from '@/config/lead-import-template';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { parseLeadType } from '@/lib/lead-type';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const importRowSchema = z.object({
  companyName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  activitySector: z.string().optional(),
  activityDomain: z.string().optional(),
  domain: z.string().optional(),
  source: z.string().optional(),
  leadType: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  geographicSituation: z.string().optional(),
  observation: z.string().optional(),
  civility: z.string().optional(),
});

const importBodySchema = z.object({
  leads: z.array(importRowSchema).min(1).max(2000),
});

/** POST /api/prospects/import — upsert entreprise + contact (pool GROUP). */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { leads: rows } = importBodySchema.parse(await req.json());
    const created: { id: string; name: string }[] = [];
    const updated: { id: string; name: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const listValidation = validateAndNormalizeLeadImportLists(row);
        if (listValidation.errors.length) {
          errors.push({
            row: excelRowNumber(i),
            message: listValidation.errors.join(' '),
          });
          continue;
        }

        const companyName = displayProspectName(row.companyName);
        const nameNormalized = normalizeProspectName(companyName);
        const { firstName, lastName } = resolveImportNames(row, companyName);
        const leadType =
          listValidation.leadType ??
          parseLeadType(row.leadType) ??
          'NON_DETERMINE';

        const { location, geographicSituation } =
          resolveImportedLocationFields(row);

        let prospect = await prisma.prospect.findFirst({
          where: { nameNormalized, deletedAt: null },
        });

        if (!prospect) {
          prospect = await prisma.prospect.create({
            data: {
              name: companyName,
              nameNormalized,
              leadType: leadType === null ? 'NON_DETERMINE' : leadType,
              activitySector: listValidation.activitySector,
              source: listValidation.source,
              location,
              geographicSituation,
              notes: row.observation?.trim() || null,
              activityDomains:
                listValidation.activityDomains.length > 0
                  ? {
                      create: listValidation.activityDomains.map((domain) => ({
                        domain,
                      })),
                    }
                  : undefined,
            },
          });
          created.push({ id: prospect.id, name: prospect.name });
        } else {
          if (location || geographicSituation) {
            prospect = await prisma.prospect.update({
              where: { id: prospect.id },
              data: {
                ...(location ? { location } : {}),
                ...(geographicSituation ? { geographicSituation } : {}),
              },
            });
          }
          updated.push({ id: prospect.id, name: prospect.name });
        }

        const email = row.email?.trim() || null;
        const phone = row.phone?.trim() || null;

        let contact =
          email || phone
            ? await prisma.prospectContact.findFirst({
                where: {
                  prospectId: prospect.id,
                  deletedAt: null,
                  createdById: user.id,
                  OR: [
                    ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
                    ...(phone ? [{ phone }] : []),
                  ],
                },
              })
            : null;

        if (!contact) {
          contact = await prisma.prospectContact.create({
            data: {
              prospectId: prospect.id,
              createdById: user.id,
              firstName,
              lastName,
              email,
              phone,
              civility: listValidation.civility,
              jobTitle: row.jobTitle?.trim() || null,
            },
          });
        } else {
          await prisma.prospectContact.update({
            where: { id: contact.id },
            data: {
              firstName,
              lastName,
              email,
              phone,
              civility: listValidation.civility,
              jobTitle: row.jobTitle?.trim() || null,
            },
          });
        }
      } catch (err) {
        errors.push({
          row: excelRowNumber(i),
          message:
            err instanceof Error ? err.message : 'Erreur ligne import',
        });
      }
    }

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_IMPORT,
      entityType: 'Prospect',
      summary: `Import prospects : ${created.length} créés, ${updated.length} mis à jour`,
      metadata: {
        created: created.length,
        updated: updated.length,
        errors: errors.length,
      },
    });

    return NextResponse.json({ created, updated, errors });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('POST /api/prospects/import error', error);
    return NextResponse.json(
      { error: "Impossible d'importer les prospects." },
      { status: 500 },
    );
  }
}
