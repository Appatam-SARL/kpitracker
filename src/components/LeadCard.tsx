"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import {
  NEGOTIATION_STAGE_STYLES,
  formatNegotiationStageLabel,
} from "@/config/negotiation-stage";
import TextToSpeech from "./TextToSpeech";

export interface LeadContactPreview {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  canViewFiche?: boolean;
  ownerName?: string | null;
}

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
  geographicSituation?: string | null;
  activitySector?: string | null;
  activityDomains?: string[];
  civility?: string | null;
  leadType?: string | null;
  decisionRole?: string | null;
  crmCompanyName?: string;
  /** Fiche contact entreprise : ids pour PATCH prospect/contact */
  prospectId?: string;
  contactId?: string;
  contacts?: LeadContactPreview[];
}

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const PREVIEW_COUNT = 4;

function initialsFrom(name: string, fallback = "E") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || fallback;
}

function contactLabel(contact: LeadContactPreview) {
  return `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
}

export default function LeadCard({
  lead,
  onClick,
  draggable,
  onDragStart,
}: LeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const companyName = lead.companyName?.trim() || "Entreprise non renseignée";
  const initials = initialsFrom(companyName);
  const statusLabel = formatNegotiationStageLabel(lead.status);
  const contacts = lead.contacts ?? [];
  const shown = expanded ? contacts : contacts.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, contacts.length - shown.length);
  const ownerNames = new Set(
    contacts.map((c) => c.ownerName?.trim()).filter(Boolean),
  );
  const showOwners = ownerNames.size > 1;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-no-drag]")) {
      e.preventDefault();
      return;
    }
    onDragStart?.(e);
  };

  return (
    <motion.div
      onClick={onClick}
      draggable={draggable}
      // framer-motion typage onDragStart (pan) ≠ DragEvent HTML5
      onDragStart={handleDragStart as any}
      className={`relative flex h-full flex-col gap-3 rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-neu-soft transition-all hover:-translate-y-0.5 hover:shadow-neu ${
        onClick ? "cursor-pointer" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary text-[11px] font-semibold text-white">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-primary">
              {companyName}
            </h3>
            <p className="text-[10px] text-gray-400">
              {contacts.length} contact{contacts.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-neu ${
            NEGOTIATION_STAGE_STYLES[
              lead.status as keyof typeof NEGOTIATION_STAGE_STYLES
            ] ?? "border-gray-100 bg-gray-50 text-gray-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {lead.crmCompanyName && (
        <span className="inline-flex w-fit rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {lead.crmCompanyName}
        </span>
      )}

      {lead.location ? (
        <p className="inline-flex min-w-0 items-center gap-1 text-[11px] text-gray-500">
          <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
          <span className="truncate">{lead.location}</span>
        </p>
      ) : null}

      <div
        data-no-drag
        className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50/80 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {shown.map((contact) => {
          const name = contactLabel(contact) || "Contact";
          const canOpen = Boolean(contact.id) && contact.canViewFiche !== false;
          const href = canOpen
            ? `/leads/${lead.id}/contacts/${contact.id}`
            : undefined;
          const meta = [contact.jobTitle, showOwners ? contact.ownerName : null]
            .filter(Boolean)
            .join(" · ");

          const inner = (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {initialsFrom(name, "?")}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[12px] font-medium text-primary">
                  {name}
                </span>
                {meta ? (
                  <span className="block truncate text-[10px] text-gray-400">
                    {meta}
                  </span>
                ) : null}
              </span>
              {canOpen ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-colors group-hover/contact:text-primary" />
              ) : null}
            </>
          );

          if (!href) {
            return (
              <div
                key={contact.id || name}
                title="Vous ne pouvez pas ouvrir cette fiche"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 opacity-60"
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={contact.id}
              href={href}
              data-no-drag
              draggable={false}
              title={`Ouvrir la fiche de ${name}`}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="group/contact flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white hover:shadow-sm"
            >
              {inner}
            </Link>
          );
        })}

        {contacts.length === 0 ? (
          <p className="px-1.5 py-2 text-[11px] text-gray-400">
            Aucun contact visible pour votre profil
          </p>
        ) : null}

        {hiddenCount > 0 ? (
          <button
            type="button"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-white"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Voir les {hiddenCount} autres
          </button>
        ) : null}

        {expanded && contacts.length > PREVIEW_COUNT ? (
          <button
            type="button"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white"
          >
            Réduire
          </button>
        ) : null}
      </div>

      <Link
        href={`/leads/${lead.id}`}
        data-no-drag
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary/80 transition-colors hover:text-primary"
      >
        Fiche entreprise
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      {lead.notes ? (
        <p className="line-clamp-2 text-[11px] text-gray-500">{lead.notes}</p>
      ) : null}
      {lead.notes ? (
        <div data-no-drag onClick={(e) => e.stopPropagation()}>
          <TextToSpeech text={lead.notes} />
        </div>
      ) : null}
    </motion.div>
  );
}
