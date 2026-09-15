import { BIIM_DOCUMENT_NONE } from '@/config/biim-contact-fields';

export type BiimDocumentUploadItem = {
  label: string;
  file: File;
};

/** Upload les fichiers BIIM liés à un contact après création. */
export async function uploadBiimContactDocuments(
  prospectId: string,
  contactId: string,
  items: BiimDocumentUploadItem[],
): Promise<void> {
  const uploads = items.filter(
    (item) => item.file && item.label && item.label !== BIIM_DOCUMENT_NONE,
  );
  await Promise.all(
    uploads.map(async (item) => {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('label', item.label);
      formData.append('contactId', contactId);
      const res = await fetch(`/api/prospects/${prospectId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : `Échec upload « ${item.label} »`,
        );
      }
    }),
  );
}
