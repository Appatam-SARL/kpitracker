import type { SalesSummaryReport } from '@/lib/sales-summary-report';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import ExcelJS from 'exceljs';
import { existsSync } from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export type SalesReportMeta = {
  title: string;
  periodFrom: string;
  periodTo: string;
  scopeLabel?: string | null;
  agentName?: string | null;
  source?: string | null;
  createdAt?: string;
};

function formatMoney(value: number): string {
  // PDFKit/Helvetica ne rend pas bien U+202F / NBSP de toLocaleString('fr-FR')
  const formatted = Math.round(value)
    .toLocaleString('fr-FR')
    .replace(/[\u202f\u00a0]/g, ' ');
  return `${formatted} FCFA`;
}

/** Montant compact pour colonnes étroites (unité dans l’en-tête). */
function formatMoneyAmount(value: number): string {
  return Math.round(value)
    .toLocaleString('fr-FR')
    .replace(/[\u202f\u00a0]/g, ' ');
}

const BLUE = 'FF2F75B6';
const RED = 'FFC00000';
const GREEN = 'FF548235';
const LIGHT = 'FFF2F2F2';

const PDF = {
  primary: '#111111',
  muted: '#6B7280',
  line: '#E5E7EB',
  soft: '#F4F4F4',
  card: '#F8F8F8',
  blue: '#2F75B6',
  red: '#C00000',
  green: '#548235',
  white: '#FFFFFF',
};

function cockpitOf(payload: SalesSummaryReport) {
  if (payload.cockpit) return payload.cockpit;
  return {
    objectiveRevenue: 0,
    realizedRevenue: payload.global.caTotal,
    remainder: payload.global.caTotal,
    concludedSalesCount: payload.global.nbClientsTotal,
    pipelineAmount: 0,
    attainmentRate: 0,
    negotiationFilter: 'Tous',
    concludedOnLabel: 'Période du rapport',
    lines: [],
  };
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-FR');
}

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'kpitracker-logo.png'),
    path.join(process.cwd(), 'public', 'kpitracker-mark.png'),
  ];
  return candidates.find((file) => existsSync(file)) ?? null;
}

function drawRoundedRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  doc.save();
  doc.roundedRect(x, y, w, h, r);
  if (fill) doc.fillColor(fill).fill();
  if (stroke) {
    doc.roundedRect(x, y, w, h, r);
    doc.strokeColor(stroke).lineWidth(0.8).stroke();
  }
  doc.restore();
}

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  ensureSpace(doc, 36);
  const y = doc.y;
  doc
    .save()
    .rect(doc.page.margins.left, y, 3, 14)
    .fill(PDF.primary);
  doc.restore();
  doc
    .fillColor(PDF.primary)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(title, doc.page.margins.left + 10, y - 1);
  doc.moveDown(0.8);
}

function drawKpiCard(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  tone: 'neutral' | 'bad' | 'good' = 'neutral',
) {
  const accent =
    tone === 'bad' ? PDF.red : tone === 'good' ? PDF.green : PDF.blue;
  drawRoundedRect(doc, x, y, w, h, 8, PDF.card, PDF.line);
  doc
    .save()
    .rect(x, y, 4, h)
    .fill(accent);
  doc.restore();
  doc
    .fillColor(PDF.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(label, x + 12, y + 10, { width: w - 20 });
  doc
    .fillColor(tone === 'bad' ? PDF.red : PDF.primary)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(value, x + 12, y + 26, { width: w - 20 });
}

function drawProgressBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  rate: number,
) {
  const clamped = Math.max(0, Math.min(100, rate));
  drawRoundedRect(doc, x, y, w, 8, 4, PDF.line);
  const fillW = Math.max(4, (w * clamped) / 100);
  drawRoundedRect(
    doc,
    x,
    y,
    fillW,
    8,
    4,
    clamped >= 100 ? PDF.green : clamped >= 50 ? PDF.blue : PDF.red,
  );
}

type PdfTableCol = {
  label: string;
  width: number;
  align?: 'left' | 'right';
  /** Autorise le retour à la ligne (ex. prestations longues). */
  wrap?: boolean;
};

function measureCellHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  width: number,
  fontSize: number,
  wrap: boolean,
): number {
  const padY = 8;
  const minH = fontSize + padY;
  if (!wrap || !text) return minH;
  doc.font('Helvetica').fontSize(fontSize);
  const h = doc.heightOfString(text, {
    width: Math.max(8, width - 8),
    align: 'left',
  });
  return Math.max(minH, h + padY);
}

function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  columns: PdfTableCol[],
  rows: string[][],
) {
  const startX = doc.page.margins.left;
  const headerH = 22;
  const fontSize = 7.5;
  const tableW = columns.reduce((s, c) => s + c.width, 0);
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  const drawHeader = () => {
    let x = startX;
    const y = doc.y;
    drawRoundedRect(doc, startX, y, tableW, headerH, 4, PDF.primary);
    columns.forEach((col) => {
      doc
        .fillColor(PDF.white)
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .text(col.label, x + 4, y + 7, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    doc.y = y + headerH + 2;
  };

  drawHeader();

  rows.forEach((row, index) => {
    const isTotal = index === rows.length - 1 && (row[0] ?? '').startsWith('Total');
    const heights = columns.map((col, i) =>
      measureCellHeight(
        doc,
        row[i] ?? '',
        col.width,
        fontSize,
        Boolean(col.wrap) && !isTotal,
      ),
    );
    const rowH = Math.max(18, ...heights);

    if (doc.y + rowH > pageBottom()) {
      doc.addPage();
      drawHeader();
    }

    const y = doc.y;
    if (index % 2 === 0 || isTotal) {
      drawRoundedRect(
        doc,
        startX,
        y,
        tableW,
        rowH,
        0,
        isTotal ? '#E8E8E8' : PDF.soft,
      );
    }

    let x = startX;
    columns.forEach((col, colIndex) => {
      const cell = row[colIndex] ?? '';
      const wrap = Boolean(col.wrap) && !isTotal;
      doc
        .fillColor(PDF.primary)
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .text(cell, x + 4, y + 4, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: wrap,
          ellipsis: !wrap,
          height: wrap ? rowH - 6 : undefined,
        });
      // PDFKit avance y après un texte multiligne : on fige la ligne
      doc.y = y;
      x += col.width;
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.8);
}

function paintLabel(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

function paintValue(cell: ExcelJS.Cell, text: string, tone: 'neutral' | 'bad' | 'good' = 'neutral') {
  cell.value = text;
  cell.font = {
    bold: true,
    size: 12,
    color: { argb: tone === 'neutral' ? 'FF111111' : 'FFFFFFFF' },
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: tone === 'bad' ? RED : tone === 'good' ? GREEN : LIGHT },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
}

export async function buildSalesReportExcelBuffer(
  payload: SalesSummaryReport,
  meta: SalesReportMeta,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KpiTracker';
  workbook.created = new Date();
  const cockpit = cockpitOf(payload);

  const sheet = workbook.addWorksheet('Pilotage ventes');
  sheet.columns = [
    { width: 34 },
    { width: 28 },
    { width: 24 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
  ];
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 24;

  paintLabel(sheet.getCell('A1'), 'OBJ CA');
  paintValue(sheet.getCell('B1'), formatMoney(cockpit.objectiveRevenue));
  paintLabel(sheet.getCell('A2'), 'TOTAL CA RÉALISÉ');
  paintValue(sheet.getCell('B2'), formatMoney(cockpit.realizedRevenue));
  paintLabel(sheet.getCell('A3'), 'Reste');
  paintValue(
    sheet.getCell('B3'),
    formatMoney(cockpit.remainder),
    cockpit.remainder < 0 ? 'bad' : 'good',
  );
  sheet.getCell('D3').value = 'Nbre de ventes conclues';
  sheet.getCell('D3').font = { bold: true, size: 12 };
  sheet.getCell('D3').alignment = { horizontal: 'right', vertical: 'middle' };
  paintValue(
    sheet.getCell('E3'),
    String(cockpit.concludedSalesCount),
    cockpit.concludedSalesCount === 0 ? 'bad' : 'good',
  );

  sheet.getCell('A5').value = 'Statut négociation';
  sheet.getCell('B5').value = cockpit.negotiationFilter;
  sheet.getCell('A6').value = 'Conclu le';
  sheet.getCell('B6').value = cockpit.concludedOnLabel;
  sheet.getCell('A7').value = 'Taux d’atteinte';
  sheet.getCell('B7').value = `${cockpit.attainmentRate.toFixed(1)} %`;
  sheet.getCell('A8').value = 'Pipeline (montant offres)';
  sheet.getCell('B8').value = formatMoney(cockpit.pipelineAmount);
  sheet.getCell('A9').value = 'Périmètre';
  sheet.getCell('B9').value = meta.scopeLabel || 'Société';
  sheet.getCell('A10').value = 'Commerciale';
  sheet.getCell('B10').value = meta.agentName || 'Toutes les commerciales';
  if (meta.source) {
    sheet.getCell('A11').value = 'Source';
    sheet.getCell('B11').value = meta.source;
  }
  for (let row = 5; row <= 11; row += 1) {
    sheet.getCell(`A${row}`).font = { color: { argb: 'FF666666' }, size: 11 };
  }

  const headerRowIndex = 13;
  const headers = [
    "Nom de l'entreprise (prospect)",
    'Prestations proposées',
    'Commerciale',
    'Stade',
    'Source',
    'Montant offres',
    'CA réalisé',
    'Nbre vente',
  ];
  headers.forEach((label, index) => {
    const cell = sheet.getCell(headerRowIndex, index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };
  });
  sheet.getRow(headerRowIndex).height = 28;

  let cursor = headerRowIndex + 1;
  for (const line of cockpit.lines) {
    const values = [
      line.prospectName,
      line.prestations,
      line.commercialName,
      line.stageLabel,
      line.source,
      line.offerAmount,
      line.realizedAmount,
      line.salesCount,
    ];
    values.forEach((value, index) => {
      const cell = sheet.getCell(cursor, index + 1);
      cell.value = value;
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE5E5E5' } },
      };
      if (index >= 5) cell.numFmt = index === 7 ? '0' : '#,##0';
    });
    cursor += 1;
  }

  const offerTotal = cockpit.lines.reduce((sum, line) => sum + line.offerAmount, 0);
  const realizedTotal = cockpit.lines.reduce((sum, line) => sum + line.realizedAmount, 0);
  const salesTotal = cockpit.lines.reduce((sum, line) => sum + line.salesCount, 0);
  sheet.getCell(cursor, 1).value = 'Total général';
  sheet.getCell(cursor, 1).font = { bold: true };
  sheet.getCell(cursor, 6).value = offerTotal;
  sheet.getCell(cursor, 7).value = realizedTotal;
  sheet.getCell(cursor, 8).value = salesTotal;
  for (const col of [1, 6, 7, 8]) {
    sheet.getCell(cursor, col).font = { bold: true };
    sheet.getCell(cursor, col).border = {
      top: { style: 'thin' },
      bottom: { style: 'double' },
    };
  }
  sheet.getCell(cursor, 6).numFmt = '#,##0';
  sheet.getCell(cursor, 7).numFmt = '#,##0';

  sheet.getCell(cursor + 2, 1).value =
    cockpit.remainder < 0
      ? `Objectif non atteint : il reste ${formatMoney(Math.abs(cockpit.remainder))} à réaliser sur la période.`
      : cockpit.objectiveRevenue > 0
        ? 'Objectif de CA atteint ou dépassé sur la période.'
        : 'Aucun objectif CA renseigné pour cette période. Le réalisé est affiché seul.';
  sheet.mergeCells(cursor + 2, 1, cursor + 2, 6);

  const byUser = workbook.addWorksheet('Par commercial');
  byUser.columns = [
    { header: 'Commercial', key: 'userName', width: 28 },
    { header: 'Leads', key: 'nbLeads', width: 12 },
    { header: 'Clients', key: 'nbClients', width: 12 },
    { header: 'CA', key: 'caTotal', width: 18 },
    { header: 'Taux %', key: 'conversionRate', width: 12 },
  ];
  for (const row of payload.byUser) {
    byUser.addRow({
      userName: row.userName,
      nbLeads: row.nbLeads,
      nbClients: row.nbClients,
      caTotal: row.caTotal,
      conversionRate: Number(row.conversionRate.toFixed(1)),
    });
  }

  const bySource = workbook.addWorksheet('Par source');
  bySource.columns = [
    { header: 'Source', key: 'source', width: 28 },
    { header: 'Leads', key: 'nbLeads', width: 12 },
    { header: 'Clients', key: 'nbClients', width: 12 },
  ];
  for (const row of payload.bySource) {
    bySource.addRow({
      source: row.source ?? 'Inconnu',
      nbLeads: row.nbLeads,
      nbClients: row.nbClients,
    });
  }

  if (payload.byCompany.length > 0) {
    const byCompany = workbook.addWorksheet('Par filiale');
    byCompany.columns = [
      { header: 'Filiale', key: 'companyName', width: 28 },
      { header: 'Prospects total', key: 'nbProspectsTotal', width: 16 },
      { header: 'Leads période', key: 'nbLeads', width: 14 },
      { header: 'Clients', key: 'nbClients', width: 12 },
      { header: 'CA', key: 'caTotal', width: 18 },
      { header: 'Taux %', key: 'conversionRate', width: 12 },
    ];
    for (const row of payload.byCompany) {
      byCompany.addRow({
        companyName: row.companyName,
        nbProspectsTotal: row.nbProspectsTotal,
        nbLeads: row.nbLeads,
        nbClients: row.nbClients,
        caTotal: row.caTotal,
        conversionRate: Number(row.conversionRate.toFixed(1)),
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildSalesReportPdfBuffer(
  payload: SalesSummaryReport,
  meta: SalesReportMeta,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 42,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: meta.title,
        Author: 'KpiTracker',
        Creator: 'KpiTracker by Appatam',
      },
    });
    // Marge basse élargie pour le pied de page
    doc.page.margins.bottom = 48;
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = doc.page.margins.right;
    const contentW = pageW - left - right;
    const cockpit = cockpitOf(payload);
    const logoPath = resolveLogoPath();
    const generatedAt = new Date().toLocaleString('fr-FR');

    // —— En-tête ——
    drawRoundedRect(doc, left, 36, contentW, 72, 10, PDF.soft, PDF.line);
    if (logoPath) {
      try {
        doc.image(logoPath, left + 14, 48, { fit: [130, 44] });
      } catch {
        doc
          .fillColor(PDF.primary)
          .font('Helvetica-Bold')
          .fontSize(14)
          .text('KpiTracker', left + 16, 58);
      }
    } else {
      doc
        .fillColor(PDF.primary)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('KpiTracker', left + 16, 58);
    }

    doc
      .fillColor(PDF.primary)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(meta.title, left + 150, 48, {
        width: contentW - 170,
        align: 'right',
      });
    doc
      .fillColor(PDF.muted)
      .font('Helvetica')
      .fontSize(9)
      .text(
        `Période : ${formatDateLabel(meta.periodFrom)} → ${formatDateLabel(meta.periodTo)}`,
        left + 150,
        70,
        { width: contentW - 170, align: 'right' },
      );
    doc.text(
      [
        meta.scopeLabel ? `Périmètre : ${meta.scopeLabel}` : null,
        meta.agentName ? `Commercial : ${meta.agentName}` : null,
        meta.source ? `Source : ${meta.source}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ') || 'Rapport de pilotage commercial',
      left + 150,
      84,
      { width: contentW - 170, align: 'right' },
    );

    doc.y = 122;

    // —— Cartes KPI ——
    const cardH = 52;
    const gap = 8;
    const cardW = (contentW - gap * 3) / 4;
    const kpiY = doc.y;
    drawKpiCard(
      doc,
      left,
      kpiY,
      cardW,
      cardH,
      'OBJ CA',
      formatMoney(cockpit.objectiveRevenue),
    );
    drawKpiCard(
      doc,
      left + cardW + gap,
      kpiY,
      cardW,
      cardH,
      'TOTAL CA RÉALISÉ',
      formatMoney(cockpit.realizedRevenue),
    );
    drawKpiCard(
      doc,
      left + (cardW + gap) * 2,
      kpiY,
      cardW,
      cardH,
      'Reste',
      formatMoney(cockpit.remainder),
      cockpit.remainder < 0 ? 'bad' : 'good',
    );
    drawKpiCard(
      doc,
      left + (cardW + gap) * 3,
      kpiY,
      cardW,
      cardH,
      'Ventes conclues',
      String(cockpit.concludedSalesCount),
      cockpit.concludedSalesCount === 0 ? 'bad' : 'good',
    );
    doc.y = kpiY + cardH + 14;

    // —— Bandeau synthèse ——
    ensureSpace(doc, 70);
    const bandY = doc.y;
    drawRoundedRect(doc, left, bandY, contentW, 58, 8, PDF.white, PDF.line);
    doc
      .fillColor(PDF.muted)
      .font('Helvetica')
      .fontSize(8)
      .text('Taux d’atteinte', left + 14, bandY + 10);
    doc
      .fillColor(PDF.primary)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`${cockpit.attainmentRate.toFixed(1)} %`, left + 14, bandY + 24);
    drawProgressBar(
      doc,
      left + 14,
      bandY + 44,
      contentW * 0.38,
      cockpit.attainmentRate,
    );

    doc
      .fillColor(PDF.muted)
      .font('Helvetica')
      .fontSize(8)
      .text('Pipeline (montant offres)', left + contentW * 0.48, bandY + 10);
    doc
      .fillColor(PDF.primary)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(formatMoney(cockpit.pipelineAmount), left + contentW * 0.48, bandY + 24);

    doc
      .fillColor(PDF.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Statut : ${cockpit.negotiationFilter}  ·  Conclu le : ${cockpit.concludedOnLabel}`,
        left + contentW * 0.48,
        bandY + 42,
        { width: contentW * 0.48 },
      );
    doc.y = bandY + 70;

    // —— Message objectif ——
    ensureSpace(doc, 36);
    const msg =
      cockpit.remainder < 0
        ? `Objectif non atteint : ${formatMoney(Math.abs(cockpit.remainder))} encore à réaliser.`
        : cockpit.objectiveRevenue > 0
          ? 'Objectif de CA atteint ou dépassé.'
          : 'Aucun objectif CA sur cette période.';
    drawRoundedRect(
      doc,
      left,
      doc.y,
      contentW,
      28,
      6,
      cockpit.remainder < 0 ? '#FEF2F2' : '#ECFDF5',
      cockpit.remainder < 0 ? '#FECACA' : '#A7F3D0',
    );
    doc
      .fillColor(cockpit.remainder < 0 ? PDF.red : PDF.green)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(msg, left + 12, doc.y + 9, { width: contentW - 24 });
    doc.y += 40;

    // —— Détail entreprises ——
    drawSectionTitle(doc, 'Détail par entreprise');
    if (cockpit.lines.length === 0) {
      doc
        .fillColor(PDF.muted)
        .font('Helvetica')
        .fontSize(9)
        .text('Aucune offre ni vente sur cette période.');
      doc.moveDown();
    } else {
      // Largeurs pensées pour A4 : prestations en wrap, montants lisibles
      const cols: PdfTableCol[] = [
        { label: 'Entreprise', width: contentW * 0.16, wrap: true },
        { label: 'Prestations', width: contentW * 0.28, wrap: true },
        { label: 'Commerciale', width: contentW * 0.13, wrap: true },
        { label: 'Stade', width: contentW * 0.1 },
        { label: 'Offres (FCFA)', width: contentW * 0.14, align: 'right' },
        { label: 'CA (FCFA)', width: contentW * 0.12, align: 'right' },
        { label: 'Ventes', width: contentW * 0.07, align: 'right' },
      ];
      const rows = cockpit.lines.map((line) => [
        line.prospectName,
        line.prestations,
        line.commercialName,
        line.stageLabel,
        formatMoneyAmount(line.offerAmount),
        formatMoneyAmount(line.realizedAmount),
        String(line.salesCount),
      ]);
      const offerTotal = cockpit.lines.reduce((s, l) => s + l.offerAmount, 0);
      const realizedTotal = cockpit.lines.reduce(
        (s, l) => s + l.realizedAmount,
        0,
      );
      const salesTotal = cockpit.lines.reduce((s, l) => s + l.salesCount, 0);
      rows.push([
        'Total général',
        '',
        '',
        '',
        formatMoneyAmount(offerTotal),
        formatMoneyAmount(realizedTotal),
        String(salesTotal),
      ]);
      drawTable(doc, cols, rows);
    }

    // —— Par commercial ——
    drawSectionTitle(doc, 'Par commercial');
    if (payload.byUser.length === 0) {
      doc.fillColor(PDF.muted).font('Helvetica').fontSize(9).text('Aucune donnée.');
      doc.moveDown();
    } else {
      drawTable(
        doc,
        [
          { label: 'Commercial', width: contentW * 0.34 },
          { label: 'Leads', width: contentW * 0.14, align: 'right' },
          { label: 'Clients', width: contentW * 0.14, align: 'right' },
          { label: 'CA', width: contentW * 0.24, align: 'right' },
          { label: 'Taux', width: contentW * 0.14, align: 'right' },
        ],
        payload.byUser.map((row) => [
          row.userName,
          String(row.nbLeads),
          String(row.nbClients),
          formatMoney(row.caTotal),
          `${row.conversionRate.toFixed(1)} %`,
        ]),
      );
    }

    // —— Par source ——
    drawSectionTitle(doc, 'Par source');
    if (payload.bySource.length === 0) {
      doc.fillColor(PDF.muted).font('Helvetica').fontSize(9).text('Aucune donnée.');
      doc.moveDown();
    } else {
      drawTable(
        doc,
        [
          { label: 'Source', width: contentW * 0.5 },
          { label: 'Leads', width: contentW * 0.25, align: 'right' },
          { label: 'Clients', width: contentW * 0.25, align: 'right' },
        ],
        payload.bySource.map((row) => [
          row.source ?? 'Inconnu',
          String(row.nbLeads),
          String(row.nbClients),
        ]),
      );
    }

    // Footers on all pages (buffer pages)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const y = doc.page.height - 32;
      doc
        .save()
        .moveTo(left, y - 8)
        .lineTo(pageW - right, y - 8)
        .strokeColor(PDF.line)
        .lineWidth(0.6)
        .stroke();
      doc.restore();
      doc
        .fillColor(PDF.muted)
        .font('Helvetica')
        .fontSize(7.5)
        .text('KpiTracker · CRM commercial · Appatam', left, y, {
          width: contentW / 2,
          align: 'left',
          lineBreak: false,
        });
      doc.text(`Page ${i + 1} / ${range.count} · ${generatedAt}`, left, y, {
        width: contentW,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
  });
}

function wordTable(
  headers: string[],
  rows: string[][],
): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, size: 18 })],
            }),
          ],
        }),
    ),
  });
  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: {
                size: Math.floor(9000 / headers.length),
                type: WidthType.DXA,
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, size: 18 })],
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
  });
}

export async function buildSalesReportDocxBuffer(
  payload: SalesSummaryReport,
  meta: SalesReportMeta,
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: meta.title,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Période : ${formatDateLabel(meta.periodFrom)} → ${formatDateLabel(meta.periodTo)}`,
          size: 20,
        }),
      ],
    }),
  ];

  if (meta.scopeLabel) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Périmètre : ${meta.scopeLabel}`, size: 20 })],
      }),
    );
  }
  if (meta.agentName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Commercial : ${meta.agentName}`, size: 20 }),
        ],
      }),
    );
  }
  if (meta.source) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Source : ${meta.source}`, size: 20 })],
      }),
    );
  }

  const cockpit = cockpitOf(payload);
  children.push(new Paragraph({ text: '' }));
  children.push(
    new Paragraph({
      text: `OBJ CA : ${formatMoney(cockpit.objectiveRevenue)}`,
    }),
  );
  children.push(
    new Paragraph({
      text: `TOTAL CA RÉALISÉ : ${formatMoney(cockpit.realizedRevenue)}`,
    }),
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Reste : ${formatMoney(cockpit.remainder)}`,
          bold: true,
          color: cockpit.remainder < 0 ? 'C00000' : '548235',
        }),
        new TextRun({
          text: `    Nbre de ventes conclues : ${cockpit.concludedSalesCount}`,
          bold: true,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      text: `Statut négociation : ${cockpit.negotiationFilter} · Conclu le : ${cockpit.concludedOnLabel}`,
    }),
  );
  children.push(
    new Paragraph({
      text: `Taux d’atteinte : ${cockpit.attainmentRate.toFixed(1)} % · Pipeline : ${formatMoney(cockpit.pipelineAmount)}`,
    }),
  );
  children.push(new Paragraph({ text: '' }));
  children.push(
    new Paragraph({
      text: 'Détail par entreprise',
      heading: HeadingLevel.HEADING_2,
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          ...children,
          wordTable(
            [
              'Entreprise',
              'Prestations',
              'Commerciale',
              'Stade',
              'Montant offres',
              'CA réalisé',
              'Nbre vente',
            ],
            cockpit.lines.length > 0
              ? cockpit.lines.map((line) => [
                  line.prospectName,
                  line.prestations,
                  line.commercialName,
                  line.stageLabel,
                  formatMoney(line.offerAmount),
                  formatMoney(line.realizedAmount),
                  String(line.salesCount),
                ])
              : [['Aucune ligne', '', '', '', '0 FCFA', '0 FCFA', '0']],
          ),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Total général',
                bold: true,
              }),
              new TextRun({
                text: ` — Offres ${formatMoney(cockpit.lines.reduce((s, l) => s + l.offerAmount, 0))} · CA ${formatMoney(cockpit.lines.reduce((s, l) => s + l.realizedAmount, 0))} · ${cockpit.lines.reduce((s, l) => s + l.salesCount, 0)} vente(s)`,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Par commercial',
            heading: HeadingLevel.HEADING_2,
          }),
          wordTable(
            ['Commercial', 'Leads', 'Clients', 'CA', 'Taux %'],
            payload.byUser.map((r) => [
              r.userName,
              String(r.nbLeads),
              String(r.nbClients),
              formatMoney(r.caTotal),
              r.conversionRate.toFixed(1),
            ]),
          ),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'Par source',
            heading: HeadingLevel.HEADING_2,
          }),
          wordTable(
            ['Source', 'Leads', 'Clients'],
            payload.bySource.map((r) => [
              r.source ?? 'Inconnu',
              String(r.nbLeads),
              String(r.nbClients),
            ]),
          ),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Généré par KpiTracker',
                size: 16,
                color: '888888',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export type DownloadFormat = 'pdf' | 'xlsx' | 'docx';

export function isDownloadFormat(value: string): value is DownloadFormat {
  return value === 'pdf' || value === 'xlsx' || value === 'docx';
}

export function contentTypeForFormat(format: DownloadFormat): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
}

export function extensionForFormat(format: DownloadFormat): string {
  return format;
}
