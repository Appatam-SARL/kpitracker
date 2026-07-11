"use client";

import { MoreVertical, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LeadAttachmentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
}

interface LeadAttachmentsListProps {
  leadId: string;
  attachments: LeadAttachmentItem[];
  onDeleted: () => void;
  loading?: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  PDF: "bg-red-100 text-red-700 border-red-200",
  JPG: "bg-amber-100 text-amber-700 border-amber-200",
  JPEG: "bg-amber-100 text-amber-700 border-amber-200",
  PNG: "bg-emerald-100 text-emerald-700 border-emerald-200",
  GIF: "bg-sky-100 text-sky-700 border-sky-200",
  WEBP: "bg-teal-100 text-teal-700 border-teal-200",
  SVG: "bg-purple-100 text-purple-700 border-purple-200",
  DOC: "bg-blue-100 text-blue-700 border-blue-200",
  DOCX: "bg-blue-100 text-blue-700 border-blue-200",
  XLS: "bg-green-100 text-green-700 border-green-200",
  XLSX: "bg-green-100 text-green-700 border-green-200",
  TXT: "bg-gray-100 text-gray-700 border-gray-200",
  CSV: "bg-gray-100 text-gray-700 border-gray-200",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getTypeStyle(type: string): string {
  const key = type.toUpperCase().replace(/^\./, "");
  return TYPE_STYLES[key] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

export default function LeadAttachmentsList({
  leadId,
  attachments,
  onDeleted,
  loading = false,
}: LeadAttachmentsListProps) {
  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Mettre cette pièce jointe à la corbeille ? Un responsable pourra la restaurer.',
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/leads/${leadId}/attachments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-3 py-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-5 text-center">
        <p className="text-[11px] text-gray-500">
          Aucune pièce jointe pour le moment
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {attachments.map((att) => (
          <li
            key={att.id}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50/80 transition-colors"
          >
            <div
              className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center text-[10px] font-bold ${getTypeStyle(att.fileType)}`}
            >
              {att.fileType.slice(0, 3)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-gray-800 truncate">
                {att.fileName}
              </p>
              <p className="text-[10px] text-gray-500">
                {formatSize(att.fileSize)} · {att.fileType}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <a
                href={att.storagePath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary font-medium hover:underline"
              >
                Ouvrir
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    aria-label="Actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleDelete(att.id);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Mettre à la corbeille
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

