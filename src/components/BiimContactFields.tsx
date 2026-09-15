'use client';

import type { ReactNode } from 'react';
import {
  BIIM_DOCUMENT_NONE,
  BIIM_DOCUMENT_OPTIONS,
  BIIM_UPLOADABLE_DOCUMENTS,
  BIIM_YES_NO_OPTIONS,
  biimYesNoToFormValue,
  normalizeBiimDocuments,
} from '@/config/biim-contact-fields';

export type BiimDocumentFileMap = Record<string, File | null>;

export type BiimContactFormValues = {
  biimDocuments: string[];
  documentFiles: BiimDocumentFileMap;
  biimRegistered: '' | 'oui' | 'non';
  biimVisited: '' | 'oui' | 'non';
  biimApproved: '' | 'oui' | 'non';
};

type BiimContactFieldsProps = {
  values: BiimContactFormValues;
  onChange: (values: BiimContactFormValues) => void;
};

function SelectRow({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className='flex flex-col gap-1 text-xs text-gray-700'>
      <span className='text-[11px] text-gray-600'>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='h-9 rounded-xl border border-gray-200 bg-white px-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40'
      >
        {children}
      </select>
    </label>
  );
}

export function emptyBiimContactFormValues(
  initial?: {
    biimDocuments?: string[] | null;
    biimDocument?: string | null;
    biimRegistered?: boolean | null;
    biimVisited?: boolean | null;
    biimApproved?: boolean | null;
  },
): BiimContactFormValues {
  const docs = normalizeBiimDocuments(
    initial?.biimDocuments ??
      (initial?.biimDocument ? [initial.biimDocument] : []),
  );
  return {
    biimDocuments: docs,
    documentFiles: {},
    biimRegistered: biimYesNoToFormValue(initial?.biimRegistered),
    biimVisited: biimYesNoToFormValue(initial?.biimVisited),
    biimApproved: biimYesNoToFormValue(initial?.biimApproved),
  };
}

export function getBiimDocumentUploads(
  values: BiimContactFormValues,
): Array<{ label: string; file: File }> {
  return values.biimDocuments
    .filter((doc) => doc !== BIIM_DOCUMENT_NONE)
    .map((label) => {
      const file = values.documentFiles[label];
      return file ? { label, file } : null;
    })
    .filter((item): item is { label: string; file: File } => Boolean(item));
}

export default function BiimContactFields({
  values,
  onChange,
}: BiimContactFieldsProps) {
  const selected = new Set(values.biimDocuments);
  const noneSelected = selected.has(BIIM_DOCUMENT_NONE);

  const toggleDocument = (doc: string) => {
    if (doc === BIIM_DOCUMENT_NONE) {
      onChange({
        ...values,
        biimDocuments: noneSelected ? [] : [BIIM_DOCUMENT_NONE],
        documentFiles: {},
      });
      return;
    }

    const nextSelected = new Set(
      values.biimDocuments.filter((d) => d !== BIIM_DOCUMENT_NONE),
    );
    if (nextSelected.has(doc)) {
      nextSelected.delete(doc);
      const nextFiles = { ...values.documentFiles };
      delete nextFiles[doc];
      onChange({
        ...values,
        biimDocuments: Array.from(nextSelected),
        documentFiles: nextFiles,
      });
      return;
    }
    nextSelected.add(doc);
    onChange({
      ...values,
      biimDocuments: Array.from(nextSelected),
    });
  };

  const setFile = (doc: string, file: File | null) => {
    onChange({
      ...values,
      documentFiles: {
        ...values.documentFiles,
        [doc]: file,
      },
    });
  };

  return (
    <div className='space-y-3 rounded-2xl border border-primary/10 bg-primary/[0.02] p-3'>
      <div>
        <p className='text-[11px] font-semibold text-primary'>
          Informations BIIM
        </p>
        <p className='text-[10px] text-gray-500'>
          Sélectionnez un ou plusieurs documents et joignez le fichier
          correspondant.
        </p>
      </div>

      <div className='space-y-2'>
        <span className='text-[11px] text-gray-600'>Documents disponibles</span>
        <div className='space-y-2'>
          {BIIM_DOCUMENT_OPTIONS.map((doc) => {
            const checked = selected.has(doc);
            const needsUpload = BIIM_UPLOADABLE_DOCUMENTS.includes(
              doc as (typeof BIIM_UPLOADABLE_DOCUMENTS)[number],
            );
            return (
              <div
                key={doc}
                className='rounded-xl border border-gray-100 bg-white px-3 py-2 space-y-2'
              >
                <label className='flex items-start gap-2 text-[11px] text-gray-700'>
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={() => toggleDocument(doc)}
                    className='mt-0.5 rounded border-gray-300 text-primary focus:ring-primary/40'
                  />
                  <span className='font-medium'>{doc}</span>
                </label>
                {checked && needsUpload ? (
                  <div className='pl-5'>
                    <input
                      type='file'
                      accept='.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                      onChange={(e) =>
                        setFile(doc, e.target.files?.[0] ?? null)
                      }
                      className='block w-full text-[11px] text-gray-600 file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[10px] file:font-medium file:text-white'
                    />
                    {values.documentFiles[doc] ? (
                      <p className='mt-1 text-[10px] text-gray-500'>
                        Fichier : {values.documentFiles[doc]?.name}
                      </p>
                    ) : (
                      <p className='mt-1 text-[10px] text-amber-600'>
                        Joignez le fichier de ce document.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-3'>
        <SelectRow
          label='Enregistré sur BIIM ?'
          value={values.biimRegistered}
          onChange={(biimRegistered) =>
            onChange({
              ...values,
              biimRegistered:
                biimRegistered as BiimContactFormValues['biimRegistered'],
            })
          }
        >
          <option value=''>Sélectionner…</option>
          {BIIM_YES_NO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectRow>

        <SelectRow
          label='Visitée ?'
          value={values.biimVisited}
          onChange={(biimVisited) =>
            onChange({
              ...values,
              biimVisited: biimVisited as BiimContactFormValues['biimVisited'],
            })
          }
        >
          <option value=''>Sélectionner…</option>
          {BIIM_YES_NO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectRow>

        <SelectRow
          label='Approuvé par BIIM'
          value={values.biimApproved}
          onChange={(biimApproved) =>
            onChange({
              ...values,
              biimApproved:
                biimApproved as BiimContactFormValues['biimApproved'],
            })
          }
        >
          <option value=''>Sélectionner…</option>
          {BIIM_YES_NO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectRow>
      </div>
    </div>
  );
}
