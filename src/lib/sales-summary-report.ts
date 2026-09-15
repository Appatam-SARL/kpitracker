import { prisma } from '@/lib/prisma';
import { activeOnlyWhere } from '@/lib/trash';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSalesSummaryDateRange(
  from: string | null,
  to: string | null,
): { fromDate: Date; toDate: Date } | null {
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return null;
  const fromDate = new Date(from + 'T00:00:00.000Z');
  const toDate = new Date(to + 'T23:59:59.999Z');
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    fromDate > toDate
  )
    return null;
  return { fromDate, toDate };
}

export type CompanySalesRow = {
  companyId: string;
  companyName: string;
  /** Prospects créés sur la période sélectionnée. */
  nbLeads: number;
  nbClients: number;
  caTotal: number;
  conversionRate: number;
  /** Stock total de prospects actifs (pool GROUP partagé). */
  nbProspectsTotal: number;
};

export type ProspectOfferLine = {
  prospectName: string;
  prestations: string;
  offerAmount: number;
  salesCount: number;
  realizedAmount: number;
  stageLabel: string;
  commercialName: string;
  source: string;
};

export type SalesCockpit = {
  objectiveRevenue: number;
  realizedRevenue: number;
  /** Réalisé − objectif (négatif = retard, comme le tableau de pilotage). */
  remainder: number;
  concludedSalesCount: number;
  pipelineAmount: number;
  attainmentRate: number;
  negotiationFilter: string;
  concludedOnLabel: string;
  lines: ProspectOfferLine[];
};

export type SalesSummaryReport = {
  global: { nbLeadsTotal: number; nbClientsTotal: number; caTotal: number };
  byUser: Array<{
    userId: string;
    userName: string;
    nbLeads: number;
    nbClients: number;
    caTotal: number;
    conversionRate: number;
  }>;
  bySource: Array<{
    source: string | null;
    nbLeads: number;
    nbClients: number;
  }>;
  /** Ventes et prospects par filiale — périmètre holding uniquement. */
  byCompany: CompanySalesRow[];
  cockpit?: SalesCockpit;
};

export type BuildSalesSummaryParams = {
  companyFilter: { companyId: string | { in: string[] } };
  fromDate: Date;
  toDate: Date;
  userId?: string;
  source?: string;
};

export async function buildSalesSummaryReport(
  params: BuildSalesSummaryParams,
): Promise<SalesSummaryReport> {
  const { companyFilter, fromDate, toDate, userId, source } = params;

  const prospectWhere = {
    ...activeOnlyWhere,
    createdAt: { gte: fromDate, lte: toDate },
    ...(source !== undefined && source !== '' && { source }),
    ...(userId && {
      contacts: { some: { createdById: userId, deletedAt: null } },
    }),
  };

  const contactWhere = {
    deletedAt: null,
    createdAt: { gte: fromDate, lte: toDate },
    ...(userId && { createdById: userId }),
    createdBy: companyFilter,
  };

  const clientWhere = {
    ...companyFilter,
    convertedAt: { gte: fromDate, lte: toDate },
    ...(userId && { convertedById: userId }),
  };

  const [
    nbLeadsTotal,
    nbClientsTotal,
    clientsForCa,
    contactUserCounts,
    clientUserCounts,
    leadSourceCounts,
    clientSourceCounts,
  ] = await Promise.all([
    prisma.prospect.count({ where: prospectWhere }),
    prisma.client.count({ where: clientWhere }),
    prisma.client.findMany({
      where: clientWhere,
      select: { totalRevenue: true },
    }),
    prisma.prospectContact.groupBy({
      by: ['createdById'],
      where: contactWhere,
      _count: { id: true },
    }),
    prisma.client.groupBy({
      by: ['convertedById'],
      where: { ...clientWhere, convertedById: { not: null } },
      _count: { id: true },
      _sum: { totalRevenue: true },
    }),
    prisma.prospect.groupBy({
      by: ['source'],
      where: prospectWhere,
      _count: { id: true },
    }),
    prisma.client.groupBy({
      by: ['source'],
      where: clientWhere,
      _count: { id: true },
    }),
  ]);

  const caTotal = clientsForCa.reduce((s, c) => s + (c.totalRevenue ?? 0), 0);

  const userIds = new Set<string>();
  contactUserCounts.forEach((r) => userIds.add(r.createdById));
  clientUserCounts.forEach(
    (r) => r.convertedById && userIds.add(r.convertedById),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const byUser: SalesSummaryReport['byUser'] = [...userIds].map((uid) => {
    const leads =
      contactUserCounts.find((r) => r.createdById === uid)?._count?.id ?? 0;
    const clientsRow = clientUserCounts.find((r) => r.convertedById === uid);
    const clients = clientsRow?._count?.id ?? 0;
    const ca = clientsRow?._sum?.totalRevenue ?? 0;
    return {
      userId: uid,
      userName: userMap.get(uid) ?? 'Inconnu',
      nbLeads: leads,
      nbClients: clients,
      caTotal: ca,
      conversionRate: leads > 0 ? (clients / leads) * 100 : 0,
    };
  });

  const sourceSet = new Set<string | null>();
  leadSourceCounts.forEach((r) => sourceSet.add(r.source ?? null));
  clientSourceCounts.forEach((r) => sourceSet.add(r.source ?? null));
  const bySource: SalesSummaryReport['bySource'] = [...sourceSet].map(
    (src) => ({
      source: src ?? 'Inconnu',
      nbLeads:
        leadSourceCounts.find((r) => (r.source ?? null) === src)?._count?.id ??
        0,
      nbClients:
        clientSourceCounts.find((r) => (r.source ?? null) === src)?._count
          ?.id ?? 0,
    }),
  );

  let byCompany: CompanySalesRow[] = [];
  const companyIds =
    typeof companyFilter.companyId === 'object' &&
    'in' in companyFilter.companyId
      ? companyFilter.companyId.in
      : null;

  if (companyIds && companyIds.length > 0) {
    const nbProspectsTotal = await prisma.prospect.count({
      where: {
        ...activeOnlyWhere,
        ...(source !== undefined && source !== '' && { source }),
      },
    });

    const [contactsInPeriod, clientByCompany, companies] = await Promise.all([
      prisma.prospectContact.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: fromDate, lte: toDate },
          ...(userId && { createdById: userId }),
          createdBy: { companyId: { in: companyIds } },
        },
        select: { createdBy: { select: { companyId: true } } },
      }),
      prisma.client.groupBy({
        by: ['companyId'],
        where: clientWhere,
        _count: { id: true },
        _sum: { totalRevenue: true },
      }),
      prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      }),
    ]);

    const leadsByCompany = new Map<string, number>();
    for (const c of contactsInPeriod) {
      const cid = c.createdBy.companyId;
      leadsByCompany.set(cid, (leadsByCompany.get(cid) ?? 0) + 1);
    }

    const nameById = new Map(companies.map((c) => [c.id, c.name]));
    byCompany = companyIds
      .map((companyId) => {
        const leads = leadsByCompany.get(companyId) ?? 0;
        const clientRow = clientByCompany.find((r) => r.companyId === companyId);
        const clients = clientRow?._count.id ?? 0;
        const ca = clientRow?._sum.totalRevenue ?? 0;
        return {
          companyId,
          companyName: nameById.get(companyId) ?? 'Entreprise inconnue',
          nbLeads: leads,
          nbClients: clients,
          caTotal: ca,
          conversionRate: leads > 0 ? (clients / leads) * 100 : 0,
          nbProspectsTotal,
        };
      })
      .filter(
        (row) =>
          row.nbLeads > 0 ||
          row.nbClients > 0 ||
          row.nbProspectsTotal > 0,
      )
      .sort((a, b) => b.nbProspectsTotal - a.nbProspectsTotal);
  }

  const cockpit = await buildSalesCockpit({
    ...params,
    fallbackRealizedRevenue: caTotal,
    fallbackConcludedCount: nbClientsTotal,
  });

  return {
    global: { nbLeadsTotal, nbClientsTotal, caTotal },
    byUser,
    bySource,
    byCompany,
    cockpit,
  };
}

const STAGE_LABEL: Record<string, string> = {
  EN_PROSPECTION: 'En prospection',
  VENTE_CONCLUE: 'Vente conclue',
  VENTE_PERDUE: 'Vente perdue',
};

function interestLabel(item: {
  customName?: string | null;
  product?: { name: string } | null;
  service?: { name: string } | null;
}): string {
  return (
    item.customName?.trim() ||
    item.product?.name?.trim() ||
    item.service?.name?.trim() ||
    ''
  );
}

function dominantStage(stages: string[]): string {
  if (stages.includes('VENTE_CONCLUE')) return 'VENTE_CONCLUE';
  if (stages.includes('EN_PROSPECTION')) return 'EN_PROSPECTION';
  if (stages.includes('VENTE_PERDUE')) return 'VENTE_PERDUE';
  return 'EN_PROSPECTION';
}

async function buildSalesCockpit(
  params: BuildSalesSummaryParams & {
    fallbackRealizedRevenue: number;
    fallbackConcludedCount: number;
  },
): Promise<SalesCockpit> {
  const { companyFilter, fromDate, toDate, userId, source } = params;

  const [goals, sales, contacts] = await Promise.all([
    prisma.salesGoal.findMany({
      where: {
        deletedAt: null,
        periodStart: { lte: toDate },
        periodEnd: { gte: fromDate },
        ...(userId ? { userId } : {}),
        user: companyFilter,
      },
      select: { targetRevenue: true },
    }),
    prisma.sale.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        ...companyFilter,
        ...(userId ? { userId } : {}),
      },
      select: {
        amount: true,
        client: {
          select: {
            name: true,
            companyName: true,
            convertedFromProspectId: true,
            source: true,
          },
        },
        user: { select: { name: true } },
        items: {
          select: {
            product: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
    }),
    prisma.prospectContact.findMany({
      where: {
        deletedAt: null,
        createdBy: companyFilter,
        ...(userId ? { createdById: userId } : {}),
        prospect: {
          deletedAt: null,
          ...(source ? { source } : {}),
        },
        OR: [
          { createdAt: { gte: fromDate, lte: toDate } },
          { updatedAt: { gte: fromDate, lte: toDate } },
          { negotiationStage: 'VENTE_CONCLUE' },
          { productInterests: { some: {} } },
          { serviceInterests: { some: {} } },
        ],
      },
      select: {
        negotiationStage: true,
        createdBy: { select: { name: true } },
        prospect: { select: { id: true, name: true, source: true } },
        productInterests: {
          select: {
            estimatedValue: true,
            customName: true,
            product: { select: { name: true } },
          },
        },
        serviceInterests: {
          select: {
            estimatedValue: true,
            customName: true,
            service: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  type Bucket = {
    prospectName: string;
    prestations: Set<string>;
    offerAmount: number;
    salesCount: number;
    realizedAmount: number;
    stages: string[];
    commercials: Set<string>;
    source: string;
  };

  const buckets = new Map<string, Bucket>();
  const ensure = (key: string, name: string, src: string | null) => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: Bucket = {
      prospectName: name.trim() || 'Non renseigné',
      prestations: new Set(),
      offerAmount: 0,
      salesCount: 0,
      realizedAmount: 0,
      stages: [],
      commercials: new Set(),
      source: src?.trim() || 'Non renseigné',
    };
    buckets.set(key, created);
    return created;
  };

  for (const contact of contacts) {
    const bucket = ensure(
      contact.prospect.id,
      contact.prospect.name,
      contact.prospect.source,
    );
    bucket.stages.push(contact.negotiationStage);
    if (contact.createdBy?.name) bucket.commercials.add(contact.createdBy.name);
    if (contact.negotiationStage === 'VENTE_CONCLUE') bucket.salesCount += 1;
    for (const item of [
      ...contact.productInterests,
      ...contact.serviceInterests,
    ]) {
      const label = interestLabel(item);
      if (label) bucket.prestations.add(label);
      bucket.offerAmount += item.estimatedValue ?? 0;
    }
  }

  for (const sale of sales) {
    const key =
      sale.client.convertedFromProspectId ||
      `client:${sale.client.companyName || sale.client.name}`;
    const bucket = ensure(
      key,
      sale.client.companyName || sale.client.name,
      sale.client.source,
    );
    bucket.realizedAmount += sale.amount ?? 0;
    if (sale.user?.name) bucket.commercials.add(sale.user.name);
    for (const item of sale.items) {
      const label = item.service?.name || item.product?.name;
      if (label) bucket.prestations.add(label);
    }
    if (!sale.client.convertedFromProspectId) bucket.salesCount += 1;
  }

  const lines: ProspectOfferLine[] = [...buckets.values()]
    .map((bucket) => ({
      prospectName: bucket.prospectName,
      prestations:
        [...bucket.prestations].sort((a, b) => a.localeCompare(b, 'fr')).join(', ') ||
        'Non renseigné',
      offerAmount: bucket.offerAmount,
      salesCount: bucket.salesCount,
      realizedAmount: bucket.realizedAmount,
      stageLabel: STAGE_LABEL[dominantStage(bucket.stages)] ?? 'En prospection',
      commercialName:
        [...bucket.commercials].sort((a, b) => a.localeCompare(b, 'fr')).join(', ') ||
        'Non renseigné',
      source: bucket.source,
    }))
    .filter(
      (line) =>
        line.offerAmount > 0 ||
        line.salesCount > 0 ||
        line.realizedAmount > 0,
    )
    .sort((a, b) => b.offerAmount - a.offerAmount || b.salesCount - a.salesCount);

  const objectiveRevenue = goals.reduce((sum, goal) => sum + (goal.targetRevenue ?? 0), 0);
  const salesRevenue = sales.reduce((sum, sale) => sum + (sale.amount ?? 0), 0);
  const realizedRevenue =
    salesRevenue > 0 ? salesRevenue : params.fallbackRealizedRevenue;
  const concludedFromContacts = contacts.filter(
    (contact) => contact.negotiationStage === 'VENTE_CONCLUE',
  ).length;
  const concludedSalesCount =
    sales.length > 0 ? sales.length : concludedFromContacts || params.fallbackConcludedCount;
  const pipelineAmount = lines.reduce((sum, line) => sum + line.offerAmount, 0);
  const remainder = realizedRevenue - objectiveRevenue;
  const attainmentRate =
    objectiveRevenue > 0 ? (realizedRevenue / objectiveRevenue) * 100 : 0;

  const fromLabel = fromDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  const toLabel = toDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' });

  return {
    objectiveRevenue,
    realizedRevenue,
    remainder,
    concludedSalesCount,
    pipelineAmount,
    attainmentRate,
    negotiationFilter: 'Tous',
    concludedOnLabel: `${fromLabel} → ${toLabel}`,
    lines,
  };
}

export type MonthlySalesMetric = {
  monthKey: string;
  monthLabel: string;
  leads: number;
  clients: number;
  ca: number;
};

const MONTH_LABELS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

function monthKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  const short = MONTH_LABELS_FR[idx] ?? m;
  return `${short} ${y}`;
}

function enumerateMonthKeys(fromDate: Date, toDate: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1),
  );
  while (cursor <= end) {
    keys.push(monthKeyFromDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

export async function buildMonthlySalesMetrics(
  params: BuildSalesSummaryParams,
): Promise<MonthlySalesMetric[]> {
  const { fromDate, toDate, userId, source } = params;

  const prospectWhere = {
    ...activeOnlyWhere,
    createdAt: { gte: fromDate, lte: toDate },
    ...(userId && {
      contacts: { some: { createdById: userId, deletedAt: null } },
    }),
    ...(source !== undefined && source !== '' && { source }),
  };

  const clientWhere = {
    ...params.companyFilter,
    convertedAt: { gte: fromDate, lte: toDate },
    ...(userId && { convertedById: userId }),
  };

  const [leads, clients] = await Promise.all([
    prisma.prospect.findMany({
      where: prospectWhere,
      select: { createdAt: true },
    }),
    prisma.client.findMany({
      where: clientWhere,
      select: { convertedAt: true, totalRevenue: true },
    }),
  ]);

  const buckets = new Map<string, MonthlySalesMetric>();
  for (const key of enumerateMonthKeys(fromDate, toDate)) {
    buckets.set(key, {
      monthKey: key,
      monthLabel: monthLabelFromKey(key),
      leads: 0,
      clients: 0,
      ca: 0,
    });
  }

  for (const lead of leads) {
    const key = monthKeyFromDate(lead.createdAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.leads += 1;
  }

  for (const client of clients) {
    if (!client.convertedAt) continue;
    const key = monthKeyFromDate(client.convertedAt);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.clients += 1;
      bucket.ca += client.totalRevenue ?? 0;
    }
  }

  return [...buckets.values()];
}
