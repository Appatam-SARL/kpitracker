"use client";

import { motion } from "framer-motion";
import type React from "react";
import TextToSpeech from "./TextToSpeech";

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  source?: string | null;
  notes?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  activitySector?: string | null;
  activityDomains?: string[];
  civility?: string | null;
  leadType?: string | null;
  crmCompanyName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  LOST: "Perdu",
  CONVERTED: "Converti",
};

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700 border border-blue-200",
  CONTACTED: "bg-amber-100 text-amber-800 border border-amber-200",
  QUALIFIED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  LOST: "bg-rose-100 text-rose-700 border border-rose-200",
  CONVERTED: "bg-teal-100 text-teal-700 border border-teal-200",
};

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export default function LeadCard({ lead, onClick, draggable, onDragStart }: LeadCardProps) {
  const initials = `${lead.firstName?.[0] ?? ""}${lead.lastName?.[0] ?? ""}`.toUpperCase();
  const statusLabel = STATUS_LABELS[lead.status] ?? lead.status;
  const companyOrSource = lead.companyName || lead.source || "Prospect";
  const contactLine = lead.email || lead.phone || "Contact non renseigné";

  return (
    <motion.div
      onClick={onClick}
      draggable={draggable}
      // framer-motion typage onDragStart (pan) ≠ DragEvent HTML5,
      // on caste donc pour laisser passer l'événement natif de drag & drop.
      onDragStart={onDragStart as any}
      className={`relative bg-white/90 rounded-2xl border border-white/70 shadow-neu-soft flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-neu transition-all p-3.5 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shadow-neu shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-semibold text-primary truncate">
              {lead.firstName} {lead.lastName}
            </h3>
            {lead.jobTitle && (
              <p className="text-[10px] text-gray-400 truncate">{lead.jobTitle}</p>
            )}
            <p className="text-[11px] text-gray-500 truncate">{companyOrSource}</p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border shadow-neu whitespace-nowrap ${
            STATUS_STYLES[lead.status] ?? "bg-gray-50 border-gray-100 text-gray-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {lead.crmCompanyName && (
        <span className="inline-flex w-fit px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">
          {lead.crmCompanyName}
        </span>
      )}

      <p className="text-[11px] text-gray-500 truncate">{contactLine}</p>

      {lead.location && (
        <p className="text-[11px] text-gray-400 truncate">{lead.location}</p>
      )}

      {lead.notes && (
        <p className="text-xs text-gray-600 line-clamp-3 mt-0.5">{lead.notes}</p>
      )}
      {lead.notes && (
        <div className="mt-1">
          <TextToSpeech text={lead.notes} />
        </div>
      )}
    </motion.div>
  );
}
