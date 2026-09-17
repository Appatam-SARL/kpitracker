'use client';

import { motion } from 'framer-motion';
import { Building2, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import {
  NEGOTIATION_STAGE_STYLES,
  formatNegotiationStageLabel,
} from '@/config/negotiation-stage';
import TextToSpeech from './TextToSpeech';

export interface LeadContactPreview {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  civility?: string | null;
  decisionRole?: string | null;
  negotiationStage?: string | null;
  canViewFiche?: boolean;
  ownerName?: string | null;
  createdById?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  canViewFiche?: boolean;
  ownerName?: string | null;
  contacts?: LeadContactPreview[];
}

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Version allégée pour le kanban */
  compact?: boolean;
}

function initialsFrom(name: string, fallback = '?') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || fallback;
}

export default function LeadCard({
  lead,
  onClick,
  draggable,
  onDragStart,
  compact = false,
}: LeadCardProps) {
  const fullName =
    `${lead.civility ? `${lead.civility} ` : ''}${lead.firstName} ${lead.lastName}`.trim() ||
    'Contact';
  const companyName = lead.companyName?.trim() || 'Entreprise non renseignée';
  const initials = initialsFrom(fullName);
  const statusLabel = formatNegotiationStageLabel(lead.status);
  const prospectId = lead.prospectId ?? lead.id;
  const contactId = lead.contactId;
  const canOpenFiche = lead.canViewFiche !== false && Boolean(contactId);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[data-no-drag]')) {
      e.preventDefault();
      return;
    }
    onDragStart?.(e);
  };

  if (compact) {
    return (
      <motion.div
        onClick={onClick}
        draggable={draggable}
        onDragStart={handleDragStart as any}
        className={`relative flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-neu-soft transition-all hover:-translate-y-0.5 hover:shadow-neu ${
          onClick ? 'cursor-pointer' : ''
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className='flex items-start justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary text-[10px] font-semibold text-white'>
              {initials}
            </div>
            <div className='flex min-w-0 flex-col'>
              <h3 className='truncate text-[13px] font-semibold leading-snug text-primary'>
                {fullName}
              </h3>
              {lead.jobTitle ? (
                <p className='truncate text-[10px] text-gray-400'>
                  {lead.jobTitle}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              NEGOTIATION_STAGE_STYLES[
                lead.status as keyof typeof NEGOTIATION_STAGE_STYLES
              ] ?? 'border-gray-100 bg-gray-50 text-gray-600'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <p className='inline-flex min-w-0 items-center gap-1.5 text-[11px] text-gray-600'>
          <Building2 className='h-3 w-3 shrink-0 text-gray-400' />
          <span className='truncate font-medium text-gray-700'>{companyName}</span>
        </p>

        {canOpenFiche ? (
          <div
            data-no-drag
            className='pt-0.5'
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href={`/leads/${prospectId}/contacts/${contactId}`}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className='inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline'
            >
              Fiche contact
              <ChevronRight className='h-3.5 w-3.5' />
            </Link>
          </div>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      draggable={draggable}
      onDragStart={handleDragStart as any}
      className={`relative flex h-full flex-col gap-3 rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-neu-soft transition-all hover:-translate-y-0.5 hover:shadow-neu ${
        onClick ? 'cursor-pointer' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary text-[11px] font-semibold text-white'>
            {initials}
          </div>
          <div className='flex min-w-0 flex-col'>
            <h3 className='line-clamp-2 text-sm font-semibold leading-snug text-primary'>
              {fullName}
            </h3>
            {lead.jobTitle ? (
              <p className='truncate text-[10px] text-gray-400'>{lead.jobTitle}</p>
            ) : null}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-neu ${
            NEGOTIATION_STAGE_STYLES[
              lead.status as keyof typeof NEGOTIATION_STAGE_STYLES
            ] ?? 'border-gray-100 bg-gray-50 text-gray-600'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className='flex flex-col gap-1.5'>
        <p className='inline-flex min-w-0 items-center gap-1.5 text-[11px] text-gray-600'>
          <Building2 className='h-3 w-3 shrink-0 text-gray-400' />
          <span className='truncate font-medium text-gray-700'>{companyName}</span>
        </p>
        {lead.location ? (
          <p className='inline-flex min-w-0 items-center gap-1 text-[11px] text-gray-500'>
            <MapPin className='h-3 w-3 shrink-0 text-gray-400' />
            <span className='truncate'>{lead.location}</span>
          </p>
        ) : null}
        {lead.ownerName ? (
          <p className='text-[10px] text-gray-400'>
            Ajouté par {lead.ownerName}
          </p>
        ) : null}
      </div>

      {lead.email || lead.phone ? (
        <div className='flex flex-col gap-0.5 text-[11px] text-gray-500'>
          {lead.email ? <span className='truncate'>{lead.email}</span> : null}
          {lead.phone ? <span>{lead.phone}</span> : null}
        </div>
      ) : null}

      <div
        data-no-drag
        className='mt-auto flex flex-wrap items-center gap-2 pt-1'
        onClick={(e) => e.stopPropagation()}
      >
        {canOpenFiche ? (
          <Link
            href={`/leads/${prospectId}/contacts/${contactId}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className='inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline'
          >
            Fiche contact
            <ChevronRight className='h-3.5 w-3.5' />
          </Link>
        ) : null}
        <Link
          href={`/leads/${prospectId}`}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className='inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-primary'
        >
          Entreprise
          <ChevronRight className='h-3.5 w-3.5' />
        </Link>
      </div>

      {lead.notes ? (
        <p className='line-clamp-2 text-[11px] text-gray-500'>{lead.notes}</p>
      ) : null}
      {lead.notes ? (
        <div data-no-drag onClick={(e) => e.stopPropagation()}>
          <TextToSpeech text={lead.notes} />
        </div>
      ) : null}
    </motion.div>
  );
}
