import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { agentCanModifyLead } from '@/lib/agentLegacyLeadAccess';
import { hasGroupCompanyScope, isGroupHoldingScopeValue } from '@/lib/group-scope-roles';
import { findLeadForImportRow } from '@/lib/lead-import-match';
import {
  buildLeadDataFromImportRow,
  resolveImportNames,
} from '@/lib/lead-import-upsert';
import {
  excelRowNumber,
  validateAndNormalizeLeadImportLists,
} from '@/lib/lead-import-validation';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const importRowSchema = z.object({
  companyName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  activitySector: z.string().optional(),
  activityDomain: z.string().optional(),
  /** Alias rétrocompatibilité anciens imports */
  domain: z.string().optional(),
  source: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  observation: z.string().optional(),
  civility: z.string().optional(),
});

const importBodySchema = z.object({
  leads: z.array(importRowSchema).min(1).max(2000),
  companyId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const { leads: rows, companyId: companyIdParam } =
      importBodySchema.parse(json);

    if (isGroupHoldingScopeValue(companyIdParam)) {
      return NextResponse.json(
        {
          error:
            "L'import nécessite une entreprise précise. Sélectionnez une filiale (pas Holding).",
        },
        { status: 400 },
      );
    }

    let effectiveCompanyId = user.companyId;
    if (hasGroupCompanyScope(user.role) && companyIdParam) {
      const exists = await prisma.company.findUnique({
        where: { id: companyIdParam },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { error: 'Entreprise introuvable' },
          { status: 400 },
        );
      }
      effectiveCompanyId = companyIdParam;
    }

    const created: { id: string; firstName: string; lastName: string }[] = [];
    const updated: { id: string; firstName: string; lastName: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const listValidation = validateAndNormalizeLeadImportLists(row);
        if (listValidation.errors.length > 0) {
          for (const message of listValidation.errors) {
            errors.push({ row: excelRowNumber(i), message });
          }
          continue;
        }

        const companyName = (row.companyName || '').trim() || 'Sans nom';
        const { firstName, lastName } = resolveImportNames(row, companyName);
        const leadData = buildLeadDataFromImportRow(
          row,
          companyName,
          firstName,
          lastName,
          listValidation,
        );

        const match = await findLeadForImportRow({
          companyId: effectiveCompanyId,
          companyName,
          email: row.email,
          phone: row.phone,
        });

        if (match.kind === 'ambiguous') {
          errors.push({
            row: excelRowNumber(i),
            message:
              'Plusieurs prospects correspondent à cette entreprise et ce contact.',
          });
          continue;
        }

        if (match.kind === 'single') {
          if (user.role === 'AGENT') {
            const canModify = await agentCanModifyLead(
              match.leadId,
              effectiveCompanyId,
              user.id,
            );
            if (!canModify) {
              errors.push({
                row: excelRowNumber(i),
                message:
                  'Accès refusé : ce prospect est géré par un autre commercial.',
              });
              continue;
            }
          }

          const lead = await prisma.lead.update({
            where: { id: match.leadId },
            data: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              phone: leadData.phone,
              email: leadData.email,
              source: leadData.source,
              activitySector: leadData.activitySector,
              activityDomains: {
                deleteMany: {},
                create: leadData.activityDomains.map((domain) => ({ domain })),
              },
              companyName: leadData.companyName,
              jobTitle: leadData.jobTitle,
              location: leadData.location,
              notes: leadData.notes,
              civility: leadData.civility,
            },
          });

          await prisma.activity.create({
            data: {
              type: 'NOTE',
              relatedTo: lead.id,
              leadId: lead.id,
              userId: user.id,
              content: `Lead mis à jour via Excel par ${user.name} (${user.email}).`,
            },
          });

          updated.push({
            id: lead.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
          });
          continue;
        }

        const lead = await prisma.lead.create({
          data: {
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            phone: leadData.phone,
            email: leadData.email,
            source: leadData.source,
            activitySector: leadData.activitySector,
            activityDomains:
              leadData.activityDomains.length > 0
                ? {
                    create: leadData.activityDomains.map((domain) => ({
                      domain,
                    })),
                  }
                : undefined,
            companyName: leadData.companyName,
            jobTitle: leadData.jobTitle,
            location: leadData.location,
            notes: leadData.notes,
            civility: leadData.civility,
            status: 'NEW',
            assignedTo: user.id,
            companyId: effectiveCompanyId,
          },
        });

        await prisma.activity.create({
          data: {
            type: 'NOTE',
            relatedTo: lead.id,
            leadId: lead.id,
            userId: user.id,
            content: `Lead importé via Excel par ${user.name} (${user.email}).`,
          },
        });

        created.push({
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
        });
      } catch (err) {
        errors.push({
          row: excelRowNumber(i),
          message: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_IMPORT,
      summary: `Import Excel : ${created.length} créé(s), ${updated.length} mis à jour`,
      metadata: {
        created: created.length,
        updated: updated.length,
        total: rows.length,
      },
    });

    return NextResponse.json({
      created: created.length,
      updated: updated.length,
      total: rows.length,
      errors,
    });
  } catch (error) {
    console.error('POST /api/leads/import error', error);
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'données';
          return `${path} : ${issue.message}`;
        })
        .join(' ; ');
      return NextResponse.json(
        { error: `Données invalides — ${details}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Impossible d’importer les leads' },
      { status: 500 },
    );
  }
}
