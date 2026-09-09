import {
  LEAD_IMPORT_COLUMN_WIDTHS,
  LEAD_IMPORT_EXAMPLE_ROW,
  LEAD_IMPORT_HEADERS,
  LEAD_IMPORT_SHEET_NAME,
  mapLeadToImportExcelRow,
  sheetRowHasRecognizedImportHeader,
  type LeadExportRecord,
} from '@/config/lead-import-template';
import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LEAD_TYPES,
} from '@/config/lead-options';
import type { DataValidation, Workbook, Worksheet } from 'exceljs';

/** Aligné sur la limite POST /api/leads/import */
export const LEAD_IMPORT_TEMPLATE_MAX_ROWS = 2000;

const LIST_SHEET_NAME = 'Listes';

const LIST_COLUMN_CONFIG: ReadonlyArray<{
  column: string;
  listColumn: string;
  options: readonly string[];
  error: string;
}> = [
  {
    column: 'A',
    listColumn: 'A',
    options: DEFAULT_CIVILITIES,
    error: 'Choisissez une civilité dans la liste (M., Mme, Mlle, etc.).',
  },
  {
    column: 'G',
    listColumn: 'D',
    options: DEFAULT_LEAD_TYPES,
    error: 'Choisissez un type de client dans la liste.',
  },
  {
    column: 'I',
    listColumn: 'B',
    options: DEFAULT_ACTIVITY_SECTORS,
    error: "Choisissez un secteur d'activités dans la liste.",
  },
  {
    column: 'K',
    listColumn: 'C',
    options: DEFAULT_LEAD_SOURCES,
    error: 'Choisissez une source dans la liste.',
  },
];

function listRangeFormula(listColumn: string, count: number): string {
  return `=${LIST_SHEET_NAME}!$${listColumn}$1:$${listColumn}$${count}`;
}

function fillListColumn(
  sheet: Worksheet,
  column: string,
  options: readonly string[],
): number {
  options.forEach((value, index) => {
    sheet.getCell(`${column}${index + 1}`).value = value;
  });
  return options.length;
}

function applyListValidationToColumn(
  sheet: Worksheet,
  column: string,
  listColumn: string,
  optionCount: number,
  error: string,
  lastDataRow: number,
): void {
  const validation: DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [listRangeFormula(listColumn, optionCount)],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Valeur non reconnue',
    error,
  };

  for (let row = 2; row <= lastDataRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = validation;
  }
}

function applyLeadsSheetLayout(sheet: Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  headerRow.height = 22;

  LEAD_IMPORT_COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function addHiddenListSheet(workbook: Workbook): Record<string, number> {
  const listSheet = workbook.addWorksheet(LIST_SHEET_NAME, {
    state: 'veryHidden',
  });
  const civilityCount = fillListColumn(listSheet, 'A', DEFAULT_CIVILITIES);
  const sectorCount = fillListColumn(listSheet, 'B', DEFAULT_ACTIVITY_SECTORS);
  const sourceCount = fillListColumn(listSheet, 'C', DEFAULT_LEAD_SOURCES);
  const leadTypeCount = fillListColumn(listSheet, 'D', DEFAULT_LEAD_TYPES);
  return {
    A: civilityCount,
    B: sectorCount,
    C: sourceCount,
    D: leadTypeCount,
  };
}

function applyListValidationsToLeadsSheet(
  sheet: Worksheet,
  listCounts: Record<string, number>,
  lastDataRow: number,
): void {
  for (const { column, listColumn, options, error } of LIST_COLUMN_CONFIG) {
    applyListValidationToColumn(
      sheet,
      column,
      listColumn,
      listCounts[listColumn] ?? options.length,
      error,
      lastDataRow,
    );
  }
}

/** Dernière ligne avec listes déroulantes (ligne 1 = en-têtes, max = limite import). */
function validationLastRow(): number {
  return LEAD_IMPORT_TEMPLATE_MAX_ROWS + 1;
}

async function createValidatedLeadsWorkbook(
  dataRows: string[][],
): Promise<Workbook> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KpiTracker';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(LEAD_IMPORT_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.addRow([...LEAD_IMPORT_HEADERS]);
  applyLeadsSheetLayout(sheet);

  for (const row of dataRows) {
    sheet.addRow(row);
  }

  const listCounts = addHiddenListSheet(workbook);
  applyListValidationsToLeadsSheet(sheet, listCounts, validationLastRow());

  return workbook;
}

type XlsxModule = typeof import('xlsx');
type XlsxWorkBook = import('xlsx').WorkBook;
type XlsxWorkSheet = import('xlsx').WorkSheet;

/**
 * Sélectionne la feuille de données à importer (onglet « Leads » en priorité).
 */
export function resolveLeadImportSheet(
  XLSX: XlsxModule,
  wb: XlsxWorkBook,
): XlsxWorkSheet | undefined {
  const leadsSheet = wb.Sheets[LEAD_IMPORT_SHEET_NAME];
  if (leadsSheet) {
    return leadsSheet;
  }

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];
    const headerRow = rows[0];
    if (headerRow && sheetRowHasRecognizedImportHeader(headerRow)) {
      return sheet;
    }
  }

  const firstName = wb.SheetNames[0];
  return firstName ? wb.Sheets[firstName] : undefined;
}

export const LEAD_IMPORT_SHEET_NOT_FOUND_ERROR =
  'Feuille de données introuvable. Utilisez l’onglet « Leads » ou un fichier avec les en-têtes attendus.';

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Génère le modèle Excel d'import avec listes déroulantes (ExcelJS).
 * Listes issues de lead-options.ts (feuille cachée « Listes »).
 */
export async function downloadLeadImportTemplate(
  filename = 'modele_import_leads.xlsx',
): Promise<void> {
  const workbook = await createValidatedLeadsWorkbook([
    [...LEAD_IMPORT_EXAMPLE_ROW],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerBrowserDownload(buffer as ArrayBuffer, filename);
}

/**
 * Export des leads : mêmes colonnes, listes déroulantes et mise en page que l'import.
 * Réimportable après modification par la commerciale.
 */
export async function buildLeadsExportBuffer(
  leads: LeadExportRecord[],
): Promise<ArrayBuffer> {
  const workbook = await createValidatedLeadsWorkbook(
    leads.map(mapLeadToImportExcelRow),
  );
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
