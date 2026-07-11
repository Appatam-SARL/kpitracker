import type { StatsExportPayload } from '@/lib/stats-export-data';
import type { MonthlySalesMetric } from '@/lib/sales-summary-report';
import {
  renderColumnChartSvg,
  renderDonutSvg,
  renderGaugeSvg,
  svgToPngBuffer,
} from '@/lib/stats-chart-svg';
import type { Workbook, Worksheet } from 'exceljs';

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF1E40AF' },
};

const SECTION_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFDBEAFE' },
};

const KPI_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF1F5F9' },
};

function mergeStyleHeader(
  sheet: Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  title: string,
): void {
  sheet.mergeCells(row, colStart, row, colEnd);
  const cell = sheet.getCell(row, colStart);
  cell.value = title;
  cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  cell.fill = HEADER_FILL;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(row).height = 28;
}

function mergeStyleSection(
  sheet: Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  title: string,
): void {
  sheet.mergeCells(row, colStart, row, colEnd);
  const cell = sheet.getCell(row, colStart);
  cell.value = title;
  cell.font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' } };
  cell.fill = SECTION_FILL;
  cell.alignment = { vertical: 'middle' };
  sheet.getRow(row).height = 22;
}

function writeKpiBox(
  sheet: Worksheet,
  row: number,
  col: number,
  label: string,
  value: string | number,
  numFmt?: string,
): void {
  sheet.mergeCells(row, col, row, col + 2);
  sheet.mergeCells(row + 1, col, row + 2, col + 2);
  const labelCell = sheet.getCell(row, col);
  labelCell.value = label;
  labelCell.font = { size: 10, color: { argb: 'FF64748B' } };
  labelCell.fill = KPI_FILL;
  labelCell.alignment = { horizontal: 'center' };

  const valueCell = sheet.getCell(row + 1, col);
  valueCell.value = value;
  valueCell.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } };
  valueCell.fill = KPI_FILL;
  valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (numFmt) valueCell.numFmt = numFmt;
  sheet.getRow(row + 1).height = 26;
  sheet.getRow(row + 2).height = 8;
}

async function addChartImage(
  workbook: Workbook,
  sheet: Worksheet,
  svg: string,
  position: { col: number; row: number; width: number; height: number },
): Promise<void> {
  const png = await svgToPngBuffer(svg);
  const imageId = workbook.addImage({
    base64: png.toString('base64'),
    extension: 'png',
  });
  sheet.addImage(imageId, {
    tl: { col: position.col, row: position.row },
    ext: { width: position.width, height: position.height },
  });
}

function goalsCaTotals(payload: StatsExportPayload): {
  realized: number;
  target: number;
  pct: number;
} {
  const realized = payload.currentGoals.reduce(
    (s, g) => s + g.realizedRevenue,
    0,
  );
  const target = payload.currentGoals.reduce((s, g) => s + g.targetRevenue, 0);
  const pct = target > 0 ? Math.min(100, (realized / target) * 100) : 0;
  return { realized, target, pct };
}

function buildHiddenChartDataSheet(
  workbook: Workbook,
  payload: StatsExportPayload,
  monthly: MonthlySalesMetric[],
): void {
  const data = workbook.addWorksheet('Données graphiques', {
    state: 'veryHidden',
  });
  let row = 1;

  data.getCell(row, 1).value = 'Mois';
  data.getCell(row, 2).value = 'Leads';
  data.getCell(row, 3).value = 'Clients';
  data.getCell(row, 4).value = 'CA (XOF)';
  row += 1;
  for (const m of monthly) {
    data.getCell(row, 1).value = m.monthLabel;
    data.getCell(row, 2).value = m.leads;
    data.getCell(row, 3).value = m.clients;
    data.getCell(row, 4).value = m.ca;
    row += 1;
  }

  row += 1;
  data.getCell(row, 1).value = 'Commercial';
  data.getCell(row, 2).value = 'Leads';
  data.getCell(row, 3).value = 'Clients';
  data.getCell(row, 4).value = 'CA (XOF)';
  row += 1;
  for (const u of payload.sales.byUser) {
    data.getCell(row, 1).value = u.userName;
    data.getCell(row, 2).value = u.nbLeads;
    data.getCell(row, 3).value = u.nbClients;
    data.getCell(row, 4).value = u.caTotal;
    row += 1;
  }

  row += 1;
  data.getCell(row, 1).value = 'Source';
  data.getCell(row, 2).value = 'Leads';
  data.getCell(row, 3).value = 'Clients';
  row += 1;
  for (const s of payload.sales.bySource) {
    data.getCell(row, 1).value = s.source ?? 'Inconnu';
    data.getCell(row, 2).value = s.nbLeads;
    data.getCell(row, 3).value = s.nbClients;
    row += 1;
  }
}

export async function addVisualDashboardSheet(
  workbook: Workbook,
  payload: StatsExportPayload,
  monthly: MonthlySalesMetric[],
): Promise<void> {
  buildHiddenChartDataSheet(workbook, payload, monthly);

  const sheet = workbook.addWorksheet('Graphiques', {
    views: [{ showGridLines: false }],
  });

  for (let c = 1; c <= 16; c++) {
    sheet.getColumn(c).width = c <= 2 ? 14 : 10;
  }

  mergeStyleHeader(sheet, 1, 1, 16, 'TABLEAU DE BORD DES VENTES');

  sheet.mergeCells(2, 1, 2, 16);
  const metaCell = sheet.getCell(2, 1);
  metaCell.value = [
    `Périmètre : ${payload.meta.scopeLabel}`,
    payload.meta.commercialLabel
      ? `Commercial : ${payload.meta.commercialLabel}`
      : null,
    `Période : ${payload.meta.salesPeriodFrom} — ${payload.meta.salesPeriodTo}`,
    payload.meta.salesSource ? `Source : ${payload.meta.salesSource}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  metaCell.font = { size: 10, color: { argb: 'FF475569' } };
  metaCell.alignment = { horizontal: 'center', wrapText: true };
  sheet.getRow(2).height = 28;

  mergeStyleSection(sheet, 4, 1, 16, 'Performance vs objectifs (période en cours)');
  const goalsCa = goalsCaTotals(payload);

  writeKpiBox(
    sheet,
    6,
    1,
    'CA réalisé (objectifs)',
    goalsCa.realized,
    '#,##0',
  );
  writeKpiBox(sheet, 6, 5, 'CA objectif', goalsCa.target, '#,##0');
  writeKpiBox(
    sheet,
    6,
    9,
    'Conversions réalisées',
    payload.goalsSummary.realizedConversions,
  );
  writeKpiBox(
    sheet,
    6,
    13,
    'Conversions objectif',
    payload.goalsSummary.targetConversions,
  );

  const gaugeSvg = renderGaugeSvg(
    goalsCa.pct,
    '% CA atteint vs objectif',
    300,
    200,
  );
  await addChartImage(workbook, sheet, gaugeSvg, {
    col: 0.2,
    row: 9,
    width: 300,
    height: 200,
  });

  const monthLabels = monthly.map((m) => m.monthLabel);
  const monthlyCaSvg = renderColumnChartSvg(
    monthLabels,
    [{ label: 'CA (XOF)', values: monthly.map((m) => m.ca), color: '#2563eb' }],
    'Évolution du CA par mois',
    680,
    280,
  );
  await addChartImage(workbook, sheet, monthlyCaSvg, {
    col: 4.2,
    row: 8.5,
    width: 680,
    height: 280,
  });

  mergeStyleSection(sheet, 22, 1, 16, 'Performance des ventes');

  const commercialLabels = payload.sales.byUser.map((u) => u.userName);
  const salesPerfSvg = renderColumnChartSvg(
    commercialLabels,
    [
      {
        label: 'Leads',
        values: payload.sales.byUser.map((u) => u.nbLeads),
        color: '#93c5fd',
      },
      {
        label: 'Clients',
        values: payload.sales.byUser.map((u) => u.nbClients),
        color: '#1d4ed8',
      },
    ],
    'Leads et clients par commercial',
    680,
    300,
  );
  await addChartImage(workbook, sheet, salesPerfSvg, {
    col: 0.2,
    row: 21.5,
    width: 680,
    height: 300,
  });

  const sourceLabels = payload.sales.bySource.map((s) => s.source ?? 'Inconnu');
  const sourceDonutSvg = renderDonutSvg(
    sourceLabels,
    payload.sales.bySource.map((s) => s.nbLeads),
    'Répartition des leads par source',
    360,
    300,
  );
  await addChartImage(workbook, sheet, sourceDonutSvg, {
    col: 9.5,
    row: 21.5,
    width: 360,
    height: 300,
  });

  mergeStyleSection(sheet, 40, 1, 16, 'Répartition des prospects');

  const civilitySvg = renderDonutSvg(
    payload.demographics.byCivility.map((r) => r.label),
    payload.demographics.byCivility.map((r) => r.count),
    'Par civilité',
    360,
    280,
  );
  await addChartImage(workbook, sheet, civilitySvg, {
    col: 0.2,
    row: 39.5,
    width: 360,
    height: 280,
  });

  const sectorSvg = renderDonutSvg(
    payload.demographics.byActivitySector.map((r) => r.label),
    payload.demographics.byActivitySector.map((r) => r.count),
    "Par secteur d'activités",
    360,
    280,
  );
  await addChartImage(workbook, sheet, sectorSvg, {
    col: 5,
    row: 39.5,
    width: 360,
    height: 280,
  });

  if (payload.meta.isHoldingScope && payload.demographics.byGroupCompany.length) {
    const companySvg = renderDonutSvg(
      payload.demographics.byGroupCompany.map((r) => r.label),
      payload.demographics.byGroupCompany.map((r) => r.count),
      'Par filiale (Holding)',
      360,
      280,
    );
    await addChartImage(workbook, sheet, companySvg, {
      col: 9.5,
      row: 39.5,
      width: 360,
      height: 280,
    });
  } else {
    const monthlyLeadsSvg = renderColumnChartSvg(
      monthLabels,
      [
        {
          label: 'Leads',
          values: monthly.map((m) => m.leads),
          color: '#60a5fa',
        },
        {
          label: 'Clients',
          values: monthly.map((m) => m.clients),
          color: '#1e40af',
        },
      ],
      'Leads et clients par mois',
      360,
      280,
    );
    await addChartImage(workbook, sheet, monthlyLeadsSvg, {
      col: 9.5,
      row: 39.5,
      width: 360,
      height: 280,
    });
  }
}
