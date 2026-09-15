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
  const formatted = Math.round(value).toLocaleString('fr-FR');
  return `${formatted} FCFA`;
}

const BLUE = 'FF2F75B6';
const RED = 'FFC00000';
const GREEN = 'FF548235';
const LIGHT = 'FFF2F2F2';

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
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(meta.title, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555');
    doc.text(
      `Période : ${formatDateLabel(meta.periodFrom)} → ${formatDateLabel(meta.periodTo)}`,
    );
    if (meta.scopeLabel) doc.text(`Périmètre : ${meta.scopeLabel}`);
    if (meta.agentName) doc.text(`Commercial : ${meta.agentName}`);
    if (meta.source) doc.text(`Source : ${meta.source}`);
    doc.moveDown();

    const cockpit = cockpitOf(payload);
    doc.fillColor('#2F75B6').fontSize(12).text('OBJ CA');
    doc.fillColor('#111111').fontSize(12).text(formatMoney(cockpit.objectiveRevenue));
    doc.fillColor('#2F75B6').text('TOTAL CA RÉALISÉ');
    doc.fillColor('#111111').text(formatMoney(cockpit.realizedRevenue));
    doc.fillColor('#2F75B6').text('Reste');
    doc.fillColor(cockpit.remainder < 0 ? '#C00000' : '#548235').text(
      formatMoney(cockpit.remainder),
    );
    doc.fillColor('#111111').text(
      `Nbre de ventes conclues : ${cockpit.concludedSalesCount}`,
    );
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#555555');
    doc.text(`Statut négociation : ${cockpit.negotiationFilter}`);
    doc.text(`Conclu le : ${cockpit.concludedOnLabel}`);
    doc.text(`Taux d’atteinte : ${cockpit.attainmentRate.toFixed(1)} %`);
    doc.text(`Pipeline (montant offres) : ${formatMoney(cockpit.pipelineAmount)}`);
    doc.moveDown();

    doc.fillColor('#111111').fontSize(13).text('Détail par entreprise');
    doc.moveDown(0.3);
    doc.fontSize(9);
    if (cockpit.lines.length === 0) {
      doc.text('Aucune offre ni vente sur cette période.');
    } else {
      for (const line of cockpit.lines) {
        doc.text(
          `${line.prospectName} — ${line.prestations} · Offres ${formatMoney(line.offerAmount)} · CA ${formatMoney(line.realizedAmount)} · ${line.salesCount} vente(s) · ${line.stageLabel} · ${line.commercialName}`,
        );
      }
    }
    doc.moveDown();
    doc.fontSize(11).text(
      cockpit.remainder < 0
        ? `Objectif non atteint : ${formatMoney(Math.abs(cockpit.remainder))} encore à réaliser.`
        : cockpit.objectiveRevenue > 0
          ? 'Objectif de CA atteint ou dépassé.'
          : 'Aucun objectif CA sur cette période.',
    );
    doc.moveDown();

    doc.fontSize(13).text('Par commercial');
    doc.moveDown(0.3);
    doc.fontSize(10);
    if (payload.byUser.length === 0) {
      doc.text('Aucune donnée.');
    } else {
      for (const row of payload.byUser) {
        doc.text(
          `${row.userName} — Leads ${row.nbLeads} · Clients ${row.nbClients} · CA ${formatMoney(row.caTotal)} · ${row.conversionRate.toFixed(1)} %`,
        );
      }
    }
    doc.moveDown();

    doc.fontSize(13).text('Par source');
    doc.moveDown(0.3);
    doc.fontSize(10);
    if (payload.bySource.length === 0) {
      doc.text('Aucune donnée.');
    } else {
      for (const row of payload.bySource) {
        doc.text(
          `${row.source ?? 'Inconnu'} — Leads ${row.nbLeads} · Clients ${row.nbClients}`,
        );
      }
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888888').text('Généré par KpiTracker', {
      align: 'center',
    });

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
