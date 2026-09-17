"use client";

import { motion } from "framer-motion";
import LeadCard, { Lead } from "./LeadCard";

interface PipelineColumnProps {
  title: string;
  status: string;
  leads: Lead[];
  onDrop?: (leadId: string, newStatus: string, fromStatus?: string) => void;
  onLeadClick?: (lead: Lead) => void;
}

export default function PipelineColumn({
  title,
  status,
  leads,
  onDrop,
  onLeadClick,
}: PipelineColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary/30");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary/30");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary/30");
    const leadId = e.dataTransfer.getData("leadId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (leadId && fromStatus !== status) {
      onDrop?.(leadId, status, fromStatus);
    }
  };

  return (
    <motion.div
      className="flex-1 bg-bgGray rounded-2xl p-3 md:p-4 shadow-neu min-w-[320px] md:min-w-[360px] flex flex-col gap-3 border border-white/70"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onDragOver={onDrop ? handleDragOver : undefined}
      onDragLeave={onDrop ? handleDragLeave : undefined}
      onDrop={onDrop ? handleDrop : undefined}
    >
      <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-bgGray/95 backdrop-blur-xs rounded-xl px-1 py-1">
        <h2 className="text-sm md:text-base font-semibold text-primary truncate">{title}</h2>
        <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] md:text-xs text-gray-600 shrink-0">
          {leads.length} contact{leads.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            compact
            onClick={() => onLeadClick?.(lead)}
            draggable={!!onDrop}
            onDragStart={
              onDrop
                ? (e) => {
                    e.dataTransfer.setData('leadId', lead.id);
                    e.dataTransfer.setData('fromStatus', lead.status);
                    e.dataTransfer.effectAllowed = 'move';
                  }
                : undefined
            }
          />
        ))}
      </div>
    </motion.div>
  );
}
