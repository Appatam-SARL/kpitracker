import type { StatsExportPayload } from '@/lib/stats-export-data';
import { addVisualDashboardSheet } from '@/lib/stats-excel-visual-dashboard';
import type { Worksheet } from 'exceljs';

function pct(realized: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (realized / target) * 100);
}

function formatExportDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function writeSectionTitle(sheet: Worksheet, row: number, title: string): number {
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, size: 12 };
  return row + 1;
}

function writeKeyValue(
  sheet: Worksheet,
  row: number,
  label: string,
  value: string | number,
): number {
  sheet.getCell(row, 1).value = label;
  sheet.getCell(row, 1).font = { bold: true };
  sheet.getCell(row, 2).value = value;
  return row + 1;
}

function writeTableHeader(
  sheet: Worksheet,
  row: number,
  headers: string[],
): number {
  headers.forEach((header, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EAF6' },
    };
  });
  return row + 1;
}

function writeLabelCountTable(
  sheet: Worksheet,
  row: number,
  title: string,
  rows: { label: string; count: number }[],
): number {
  if (rows.length === 0) return row;
  row = writeSectionTitle(sheet, row, title);
  row = writeTableHeader(sheet, row, ['Libellé', 'Nombre']);
  for (const item of rows) {
    sheet.getCell(row, 1).value = item.label;
    sheet.getCell(row, 2).value = item.count;
    row += 1;
  }
  return row + 1;
}

export async function buildStatsDashboardExcelBuffer(
  payload: StatsExportPayload,
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KpiTracker';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tableau de bord', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 14;

  let row = 1;
  row = writeSectionTitle(sheet, row, 'Tableau de bord — Statistiques CRM');
  row += 1;
  row = writeKeyValue(sheet, row, 'Périmètre', payload.meta.scopeLabel);
  if (payload.meta.commercialLabel) {
    row = writeKeyValue(
      sheet,
      row,
      'Commercial',
      payload.meta.commercialLabel,
    );
  }
  row = writeKeyValue(
    sheet,
    row,
    'Période ventes',
    `${payload.meta.salesPeriodFrom} — ${payload.meta.salesPeriodTo}`,
  );
  if (payload.meta.salesSource) {
    row = writeKeyValue(sheet, row, 'Source (ventes)', payload.meta.salesSource);
  }
  row = writeKeyValue(
    sheet,
    row,
    'Export généré le',
    formatExportDate(payload.meta.exportedAt),
  );
  row = writeKeyValue(
    sheet,
    row,
    'Note',
    'Répartition prospects et objectifs : instantané au périmètre sélectionné (hors filtre période ventes).',
  );
  row += 1;

  row = writeSectionTitle(sheet, row, 'Résumé des ventes (période sélectionnée)');
  row = writeTableHeader(sheet, row, ['Indicateur', 'Valeur']);
  sheet.getCell(row, 1).value = 'Leads';
  sheet.getCell(row, 2).value = payload.sales.global.nbLeadsTotal;
  row += 1;
  sheet.getCell(row, 1).value = 'Clients';
  sheet.getCell(row, 2).value = payload.sales.global.nbClientsTotal;
  row += 1;
  sheet.getCell(row, 1).value = 'CA total (XOF)';
  sheet.getCell(row, 2).value = payload.sales.global.caTotal;
  sheet.getCell(row, 2).numFmt = '#,##0';
  row += 2;

  row = writeSectionTitle(sheet, row, 'Ventes par commercial');
  row = writeTableHeader(sheet, row, [
    'Commercial',
    'Leads',
    'Clients',
    'CA (XOF)',
    'Taux conversion (%)',
  ]);
  for (const item of payload.sales.byUser) {
    sheet.getCell(row, 1).value = item.userName;
    sheet.getCell(row, 2).value = item.nbLeads;
    sheet.getCell(row, 3).value = item.nbClients;
    sheet.getCell(row, 4).value = item.caTotal;
    sheet.getCell(row, 4).numFmt = '#,##0';
    sheet.getCell(row, 5).value = Number(item.conversionRate.toFixed(1));
    row += 1;
  }
  row += 1;

  row = writeSectionTitle(sheet, row, 'Ventes par source');
  row = writeTableHeader(sheet, row, ['Source', 'Leads', 'Clients']);
  for (const item of payload.sales.bySource) {
    sheet.getCell(row, 1).value = item.source ?? 'Inconnu';
    sheet.getCell(row, 2).value = item.nbLeads;
    sheet.getCell(row, 3).value = item.nbClients;
    row += 1;
  }
  row += 1;

  row = writeSectionTitle(sheet, row, 'Répartition des prospects');
  row = writeKeyValue(sheet, row, 'Total prospects', payload.demographics.total);
  row += 1;
  row = writeLabelCountTable(
    sheet,
    row,
    'Par civilité',
    payload.demographics.byCivility,
  );
  row = writeLabelCountTable(
    sheet,
    row,
    "Par secteur d'activités",
    payload.demographics.byActivitySector,
  );
  if (payload.meta.isHoldingScope && payload.sales.byCompany.length > 0) {
    row = writeSectionTitle(sheet, row, 'Par entreprise (filiales du groupe)');
    row = writeTableHeader(sheet, row, [
      'Filiale',
      'Prospects (total)',
      'Prospects (période)',
      'Clients (période)',
      'CA (XOF)',
      'Taux conversion (%)',
    ]);
    for (const item of payload.sales.byCompany) {
      sheet.getCell(row, 1).value = item.companyName;
      sheet.getCell(row, 2).value = item.nbProspectsTotal;
      sheet.getCell(row, 3).value = item.nbLeads;
      sheet.getCell(row, 4).value = item.nbClients;
      sheet.getCell(row, 5).value = item.caTotal;
      sheet.getCell(row, 5).numFmt = '#,##0';
      sheet.getCell(row, 6).value = Number(item.conversionRate.toFixed(1));
      row += 1;
    }
    row += 1;
  }
  row = writeLabelCountTable(
    sheet,
    row,
    'Par situation géographique',
    payload.demographics.byLocation,
  );
  row = writeLabelCountTable(
    sheet,
    row,
    'Par poste du prospect',
    payload.demographics.byJobTitle,
  );

  row = writeSectionTitle(sheet, row, 'Objectifs en cours');
  row = writeTableHeader(sheet, row, [
    'Commercial',
    'Période',
    'Conversions réalisé',
    'Conversions objectif',
    'Atteinte conversions (%)',
    'CA réalisé (XOF)',
    'CA objectif (XOF)',
    'Atteinte CA (%)',
  ]);
  if (payload.currentGoals.length === 0) {
    sheet.getCell(row, 1).value = 'Aucun objectif en cours sur ce périmètre.';
    row += 1;
  } else {
    for (const g of payload.currentGoals) {
      sheet.getCell(row, 1).value = g.user.name;
      sheet.getCell(row, 2).value = g.periodLabel;
      sheet.getCell(row, 3).value = g.realizedConversions;
      sheet.getCell(row, 4).value = g.targetConversions;
      sheet.getCell(row, 5).value = Number(
        pct(g.realizedConversions, g.targetConversions).toFixed(1),
      );
      sheet.getCell(row, 6).value = g.realizedRevenue;
      sheet.getCell(row, 6).numFmt = '#,##0';
      sheet.getCell(row, 7).value = g.targetRevenue;
      sheet.getCell(row, 7).numFmt = '#,##0';
      sheet.getCell(row, 8).value = Number(
        pct(g.realizedRevenue, g.targetRevenue).toFixed(1),
      );
      row += 1;
    }
  }
  row += 1;

  row = writeSectionTitle(sheet, row, 'Synthèse objectifs');
  row = writeTableHeader(sheet, row, ['Indicateur', 'Valeur']);
  sheet.getCell(row, 1).value = 'Objectifs définis';
  sheet.getCell(row, 2).value = payload.goalsSummary.goalsDefined;
  row += 1;
  sheet.getCell(row, 1).value = 'Commerciaux concernés';
  sheet.getCell(row, 2).value = payload.goalsSummary.commercialsCount;
  row += 1;
  sheet.getCell(row, 1).value = 'Conversions réalisées / objectif total';
  sheet.getCell(row, 2).value = `${payload.goalsSummary.realizedConversions} / ${payload.goalsSummary.targetConversions}`;
  row += 2;

  row = writeSectionTitle(sheet, row, 'Historique des objectifs');
  row = writeTableHeader(sheet, row, [
    'Commercial',
    'Période',
    'Conversions réalisé',
    'Conversions objectif',
    'CA réalisé (XOF)',
    'CA objectif (XOF)',
  ]);
  if (payload.goals.length === 0) {
    sheet.getCell(row, 1).value = 'Aucun objectif défini sur ce périmètre.';
    row += 1;
  } else {
    for (const g of payload.goals) {
      sheet.getCell(row, 1).value = g.user.name;
      sheet.getCell(row, 2).value = g.periodLabel;
      sheet.getCell(row, 3).value = g.realizedConversions;
      sheet.getCell(row, 4).value = g.targetConversions;
      sheet.getCell(row, 5).value = g.realizedRevenue;
      sheet.getCell(row, 5).numFmt = '#,##0';
      sheet.getCell(row, 6).value = g.targetRevenue;
      sheet.getCell(row, 6).numFmt = '#,##0';
      row += 1;
    }
  }

  await addVisualDashboardSheet(workbook, payload, payload.monthlySales);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
