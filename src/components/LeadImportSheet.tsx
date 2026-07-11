'use client';

import {
  LEAD_IMPORT_HEADERS_HELP,
  type LeadImportRow,
  buildImportHeaderMap,
  createEmptyImportRow,
} from '@/config/lead-import-template';
import {
  LEAD_IMPORT_SHEET_NOT_FOUND_ERROR,
  downloadLeadImportTemplate,
  resolveLeadImportSheet,
} from '@/lib/lead-import-excel';
import {
  excelRowNumber,
  validateAndNormalizeLeadImportLists,
} from '@/lib/lead-import-validation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRef, useState } from 'react';

export type { LeadImportRow };

interface LeadImportSheetProps {
  open: boolean;
  onClose: () => void;
  /** Société cible (rôles périmètre groupe), aligné sur l&apos;export. */
  companyId?: string | null;
  onImported?: (summary: { created: number; updated: number }) => void;
}

function parseExcelFile(file: File): Promise<LeadImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Fichier illisible'));
          return;
        }
        import('xlsx')
          .then((XLSX) => {
            const wb = XLSX.read(data, { type: 'array' });
            const dataSheet = resolveLeadImportSheet(XLSX, wb);
            if (!dataSheet) {
              reject(new Error('Aucune feuille trouvée'));
              return;
            }
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
              dataSheet,
              { defval: '', raw: false },
            );
            if (!rows.length) {
              resolve([]);
              return;
            }

            const headerMap = buildImportHeaderMap(Object.keys(rows[0]));
            if (Object.keys(headerMap).length === 0) {
              reject(new Error(LEAD_IMPORT_SHEET_NOT_FOUND_ERROR));
              return;
            }

            const mapped: LeadImportRow[] = rows.map((row) => {
              const result = createEmptyImportRow();
              const resultAny = result as Record<string, string | undefined>;
              for (const [key, value] of Object.entries(row)) {
                const field = headerMap[key];
                if (!field) continue;
                const v = String(value ?? '').trim();
                if (!v) continue;

                if (field === 'companyName') {
                  if (!result.companyName) result.companyName = v;
                } else if (!resultAny[field]) {
                  resultAny[field] = v;
                }
              }
              if (!result.companyName) {
                result.companyName = 'Sans nom';
              }
              return result;
            });
            resolve(mapped);
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}

export default function LeadImportSheet({
  open,
  onClose,
  companyId,
  onImported,
}: LeadImportSheetProps) {
  const [rows, setRows] = useState<LeadImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    { row: number; message: string }[] | null
  >(null);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    updated: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    setError(null);
    try {
      await downloadLeadImportTemplate();
    } catch (e) {
      setError(
        'Impossible de générer le modèle Excel. Veuillez réessayer plus tard.',
      );
      console.error(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadError(null);
    setImportErrors(null);
    setImportSummary(null);
    const ext = file.name.toLowerCase().slice(-5);
    if (!ext.includes('xlsx') && !ext.includes('xls')) {
      setError('Veuillez sélectionner un fichier Excel (.xlsx ou .xls).');
      return;
    }
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        setError(
          `Aucune ligne trouvée. Vérifiez les en-têtes : ${LEAD_IMPORT_HEADERS_HELP}.`,
        );
        setRows([]);
      } else {
        setRows(parsed);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la lecture du fichier.',
      );
      setRows([]);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setUploadError(null);
    setImportErrors(null);
    setImportSummary(null);

    const validationErrors: { row: number; message: string }[] = [];
    rows.forEach((row, index) => {
      const { errors } = validateAndNormalizeLeadImportLists(row);
      for (const message of errors) {
        validationErrors.push({ row: excelRowNumber(index), message });
      }
    });

    if (validationErrors.length > 0) {
      setImportErrors(validationErrors);
      setImportSummary({ created: 0, updated: 0, total: rows.length });
      setUploadError(
        `${validationErrors.length} erreur(s) de validation détectée(s). Corrigez les valeurs indiquées dans votre fichier Excel (listes déroulantes des colonnes Civilité, Secteur, Domaine et Source), puis réessayez.`,
      );
      setLoading(false);
      return;
    }

    try {
      const payload: { leads: LeadImportRow[]; companyId?: string } = {
        leads: rows,
      };
      if (companyId) payload.companyId = companyId;

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Import impossible');
      const created = Number(data.created ?? 0);
      const updated = Number(data.updated ?? 0);
      const total = Number(data.total ?? rows.length);
      const errors: { row: number; message: string }[] = Array.isArray(
        data.errors,
      )
        ? data.errors
        : [];

      if (created > 0 || updated > 0) {
        onImported?.({ created, updated });
      }

      if (errors.length > 0) {
        setImportErrors(errors);
        setImportSummary({ created, updated, total });
      } else {
        setRows([]);
        handleClose();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur d’import');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setError(null);
    setUploadError(null);
    setImportErrors(null);
    setImportSummary(null);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className='flex flex-col max-w-xl overflow-hidden'>
        <SheetHeader>
          <SheetTitle>Importer des leads depuis un fichier Excel</SheetTitle>
          <SheetDescription>
            Exportez vos leads, corrigez le fichier Excel puis réimportez-le.
            Une ligne avec la même entreprise et le même email ou téléphone
            qu&apos;un prospect existant sera mise à jour ; les autres seront
            créées. Colonnes : {LEAD_IMPORT_HEADERS_HELP}.
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-col gap-4 flex-1 min-h-0 overflow-hidden'>
          <div className='flex flex-wrap items-center gap-2'>
            <input
              ref={fileInputRef}
              type='file'
              accept='.xlsx,.xls'
              onChange={handleFileChange}
              className='hidden'
            />
            <button
              type='button'
              onClick={handleDownloadTemplate}
              className='px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50'
            >
              Télécharger le modèle Excel
            </button>
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50'
            >
              Choisir un fichier Excel
            </button>
          </div>

          {error && <p className='text-xs text-rose-600'>{error}</p>}
          {uploadError && (
            <p className='text-xs text-rose-600'>{uploadError}</p>
          )}
          {importSummary && importErrors && importErrors.length > 0 && (
            <div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 max-h-48 overflow-y-auto'>
              <p className='font-semibold mb-1'>
                {importSummary.created === 0 && importSummary.updated === 0
                  ? 'Import annulé — aucune ligne valide'
                  : 'Certaines lignes n&apos;ont pas été importées'}
              </p>
              {(importSummary.created > 0 || importSummary.updated > 0) && (
                <p className='mb-1'>
                  {importSummary.created} créé(s), {importSummary.updated}{' '}
                  mis à jour sur {importSummary.total} ligne(s).
                </p>
              )}
              <ul className='list-disc list-inside space-y-1'>
                {importErrors.map((err, idx) => (
                  <li key={`${err.row}-${idx}`}>
                    <span className='font-medium'>Ligne Excel {err.row}</span>{' '}
                    — {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <p className='text-[11px] text-gray-500'>
                {rows.length} ligne(s) prête(s) à l&apos;import. Aperçu (20
                premières) :
              </p>
              <div className='flex-1 min-h-0 overflow-auto rounded-xl border border-gray-100'>
                <Table>
                  <TableHeader>
                    <TableRow className='border-b border-gray-100'>
                      <TableHead className='text-[10px]'>Nom</TableHead>
                      <TableHead className='text-[10px]'>Prénom</TableHead>
                      <TableHead className='text-[10px]'>Entreprise</TableHead>
                      <TableHead className='text-[10px]'>Poste</TableHead>
                      <TableHead className='text-[10px]'>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((r, i) => (
                      <TableRow key={i} className='border-b border-gray-50'>
                        <TableCell className='py-1.5 text-[11px]'>
                          {r.lastName ?? '—'}
                        </TableCell>
                        <TableCell className='py-1.5 text-[11px]'>
                          {r.firstName ?? '—'}
                        </TableCell>
                        <TableCell className='py-1.5 text-[11px]'>
                          {r.companyName}
                        </TableCell>
                        <TableCell className='py-1.5 text-[11px]'>
                          {r.jobTitle ?? '—'}
                        </TableCell>
                        <TableCell className='py-1.5 text-[11px]'>
                          {r.source ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className='flex items-center gap-2 pt-2 border-t border-gray-100'>
                <button
                  type='button'
                  onClick={handleImport}
                  disabled={loading}
                  className='px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-neu disabled:opacity-60'
                >
                  {loading
                    ? 'Import en cours…'
                    : `Importer ${rows.length} lead(s)`}
                </button>
                <button
                  type='button'
                  onClick={handleClose}
                  className='px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs'
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
