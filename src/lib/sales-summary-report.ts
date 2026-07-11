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
  /** Stock total de prospects actifs sur la filiale (hors filtre période). */
  nbProspectsTotal: number;
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

  const leadWhere = {
    ...companyFilter,
    ...activeOnlyWhere,
    createdAt: { gte: fromDate, lte: toDate },
    ...(userId && { assignedTo: userId }),
    ...(source !== undefined && source !== '' && { source }),
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
    leadUserCounts,
    clientUserCounts,
    leadSourceCounts,
    clientSourceCounts,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.client.count({ where: clientWhere }),
    prisma.client.findMany({
      where: clientWhere,
      select: { totalRevenue: true },
    }),
    prisma.lead.groupBy({
      by: ['assignedTo'],
      where: { ...leadWhere, assignedTo: { not: null } },
      _count: { id: true },
    }),
    prisma.client.groupBy({
      by: ['convertedById'],
      where: { ...clientWhere, convertedById: { not: null } },
      _count: { id: true },
      _sum: { totalRevenue: true },
    }),
    prisma.lead.groupBy({
      by: ['source'],
      where: leadWhere,
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
  leadUserCounts.forEach((r) => r.assignedTo && userIds.add(r.assignedTo));
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
      leadUserCounts.find((r) => r.assignedTo === uid)?._count?.id ?? 0;
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
    const prospectStockWhere = {
      companyId: { in: companyIds },
      ...activeOnlyWhere,
      ...(userId && { assignedTo: userId }),
      ...(source !== undefined && source !== '' && { source }),
    };

    const [leadByCompany, clientByCompany, prospectStockByCompany, companies] =
      await Promise.all([
        prisma.lead.groupBy({
          by: ['companyId'],
          where: leadWhere,
          _count: { id: true },
        }),
        prisma.client.groupBy({
          by: ['companyId'],
          where: clientWhere,
          _count: { id: true },
          _sum: { totalRevenue: true },
        }),
        prisma.lead.groupBy({
          by: ['companyId'],
          where: prospectStockWhere,
          _count: { id: true },
        }),
        prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        }),
      ]);

    const nameById = new Map(companies.map((c) => [c.id, c.name]));
    byCompany = companyIds
      .map((companyId) => {
        const leads =
          leadByCompany.find((r) => r.companyId === companyId)?._count.id ?? 0;
        const clientRow = clientByCompany.find((r) => r.companyId === companyId);
        const clients = clientRow?._count.id ?? 0;
        const ca = clientRow?._sum.totalRevenue ?? 0;
        const nbProspectsTotal =
          prospectStockByCompany.find((r) => r.companyId === companyId)?._count
            .id ?? 0;
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

  return {
    global: { nbLeadsTotal, nbClientsTotal, caTotal },
    byUser,
    bySource,
    byCompany,
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
  const { companyFilter, fromDate, toDate, userId, source } = params;

  const leadWhere = {
    ...companyFilter,
    ...activeOnlyWhere,
    createdAt: { gte: fromDate, lte: toDate },
    ...(userId && { assignedTo: userId }),
    ...(source !== undefined && source !== '' && { source }),
  };

  const clientWhere = {
    ...companyFilter,
    convertedAt: { gte: fromDate, lte: toDate },
    ...(userId && { convertedById: userId }),
  };

  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
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
