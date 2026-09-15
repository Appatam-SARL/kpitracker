"use client";

import { useCallback, useState } from "react";
import { CloudUpload, FileUp } from "lucide-react";

interface LeadAttachmentUploadZoneProps {
  leadId: string;
  contactId?: string;
  onUploaded: () => void;
  disabled?: boolean;
}

export default function LeadAttachmentUploadZone({
  leadId,
  contactId,
  onUploaded,
  disabled = false,
}: LeadAttachmentUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file || file.size === 0) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (contactId) formData.append("contactId", contactId);
        const res = await fetch(`/api/leads/${leadId}/attachments`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Échec de l'upload");
        }
        onUploaded();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'upload");
      } finally {
        setUploading(false);
      }
    },
    [leadId, contactId, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [disabled, uploading, uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  return (
    <div
      className={
        "relative rounded-2xl border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center gap-2 min-h-[120px] transition-colors " +
        (dragging && !disabled
          ? "border-primary bg-primary/5"
          : "border-gray-200 bg-gray-50/80") +
        (disabled ? " opacity-60 pointer-events-none" : "")
      }
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className={
            "w-10 h-10 rounded-xl flex items-center justify-center " +
            (dragging ? "bg-primary/10" : "bg-gray-200/80")
          }
        >
          <CloudUpload
            className={
              "w-5 h-5 " + (dragging ? "text-primary" : "text-gray-500")
            }
          />
        </div>
        <p className="text-[11px] text-gray-600 font-medium">
          Glissez-déposez vos fichiers ici
        </p>
        <p className="text-[10px] text-gray-400">ou</p>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 text-white text-[11px] font-medium cursor-pointer hover:bg-gray-700 transition-colors">
          <FileUp className="w-4 h-4" />
          <span>Choisir un fichier</span>
          <input
            type="file"
            className="sr-only"
            onChange={handleInputChange}
            disabled={disabled || uploading}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
        </label>
      </div>
      {uploading && (
        <p className="text-[10px] text-primary font-medium animate-pulse">
          Envoi en cours...
        </p>
      )}
      {error && (
        <p className="text-[10px] text-rose-500 font-medium">{error}</p>
      )}
    </div>
  );
}
