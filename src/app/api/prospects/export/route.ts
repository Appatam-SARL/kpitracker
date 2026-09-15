import { buildLeadsExportBuffer } from '@/lib/lead-import-excel';
import { formatLeadTypeLabel } from '@/lib/lead-type';
import { getCurrentUser } from '@/lib/auth';
import {
  canViewAllProspectContacts,
  canViewContactFiche,
  requireGroupProspectsAccess,
} from '@/lib/prospect-access';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/prospects/export — export Excel (une ligne par contact). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const prospects = await prisma.prospect.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        activityDomains: { select: { domain: true } },
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { companyId: true } } },
        },
      },
    });

    const seeAllContacts = canViewAllProspectContacts(user);
    const rows = prospects.flatMap((p) => {
      const visible = seeAllContacts
        ? p.contacts
        : p.contacts.filter((c) => canViewContactFiche(user, c));
      if (visible.length === 0) return [];
      const contacts = visible;
      return contacts.map((c) => ({
        civility: c.civility,
        lastName: c.lastName || p.name,
        firstName: c.firstName || 'Contact',
        phone: c.phone,
        email: c.email,
        companyName: p.name,
        leadType: formatLeadTypeLabel(p.leadType),
        jobTitle: c.jobTitle,
        activitySector: p.activitySector,
        activityDomains: p.activityDomains.map((d) => d.domain),
        source: p.source,
        location: p.location,
        geographicSituation: p.geographicSituation,
        notes: p.notes,
      }));
    });

    const buffer = await buildLeadsExportBuffer(rows);
    const dateStr = new Date().toISOString().slice(0, 10);

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_EXPORT,
      entityType: 'Prospect',
      summary: `Export de ${rows.length} ligne(s) prospects`,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="prospects_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/prospects/export error', error);
    return NextResponse.json(
      { error: "Impossible d'exporter les prospects." },
      { status: 500 },
    );
  }
}
