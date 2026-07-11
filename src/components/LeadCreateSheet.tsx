"use client";

import { useState, type FormEvent } from "react";
import ActivityDomainsChecklist from "./ActivityDomainsChecklist";
import NeumoCard from "./NeumoCard";
import { Field } from "./ui/field";
import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
  DEFAULT_LEAD_SOURCES,
} from "@/config/lead-options";

interface LeadCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (lead: any) => void;
}

// Options alignées avec l'enum LeadStatus du schema Prisma
const STATUS_OPTIONS = [
  { value: "NEW", label: "Nouveau lead" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "CONVERTED", label: "Converti" },
  { value: "LOST", label: "Perdu" },
];

export default function LeadCreateSheet({ open, onClose, onCreated }: LeadCreateSheetProps) {
  const [status, setStatus] = useState("NEW");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivityDomains, setSelectedActivityDomains] = useState<string[]>([]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const firstName = String(data.get("firstName") || "");
    const lastName = String(data.get("lastName") || "");
    const email = String(data.get("email") || "");
    const phone = String(data.get("phone") || "");
    const source = String(data.get("source") || "");
    const activitySector = String(data.get("activitySector") || "");
    const civility = String(data.get("civility") || "");
    const notes = String(data.get("notes") || "");
    const companyName = String(data.get("companyName") || "");
    const jobTitle = String(data.get("jobTitle") || "");
    const location = String(data.get("location") || "");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          source: source || undefined,
          activitySector: activitySector || undefined,
          activityDomains:
            selectedActivityDomains.length > 0
              ? selectedActivityDomains
              : undefined,
          civility: civility || undefined,
          companyName: companyName || undefined,
          jobTitle: jobTitle || undefined,
          location: location || undefined,
          notes: notes || undefined,
          // laissé vide côté front, l'API rattache à une company par défaut
          status,
          companyId: undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Impossible de créer le lead");
      }

      const created = await res.json();
      onCreated?.(created);
      form.reset();
      setStatus("NEW");
      setSelectedActivityDomains([]);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="h-full w-full max-w-md bg-transparent p-4" onClick={onClose}>
        <div
          className="h-full"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <NeumoCard className="h-full max-h-[90vh] bg-white p-5 flex flex-col gap-4 shadow-neu-soft overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-primary">Nouveau lead</h2>
                <p className="text-[11px] text-gray-500">
                  Enregistrez un prospect dans votre pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-3 text-xs text-gray-700 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Field name="firstName" label="Prénom" placeholder="Ex: Awa" required />
                <Field name="lastName" label="Nom" placeholder="Ex: Koné" required />
              </div>
              <Field name="email" type="email" label="Email" placeholder="awa@example.com" />
              <Field name="phone" label="Téléphone" placeholder="Ex: +225 07 45 12 89" />
              <Field
                name="companyName"
                label="Nom de la compagnie"
                placeholder="Ex: Appatam Sarl"
                description="Nom de l'entreprise rattachée à ce lead."
              />
              <Field
                name="jobTitle"
                label="Poste / Fonction"
                placeholder="Ex: Directeur commercial"
              />
              <Field
                name="location"
                label="Localisation"
                placeholder="Adresse ou lieu (pour la carte)"
                description="Adresse ou localisation géographique du lead."
              />
              <Field
                name="source"
                label="Source"
                placeholder="Facebook, WhatsApp, Site web..."
                description="Permet d'analyser d'où viennent vos leads."
                list="lead-source-options"
              />
              <datalist id="lead-source-options">
                {DEFAULT_LEAD_SOURCES.map((src) => (
                  <option key={src} value={src} />
                ))}
              </datalist>
              <Field
                name="activitySector"
                label="Secteur d'activités"
                placeholder="Ex: Commerce & retail, BTP & construction..."
                description="Secteur d'activité économique du lead."
                list="lead-activity-sector-options"
              />
              <datalist id="lead-activity-sector-options">
                {DEFAULT_ACTIVITY_SECTORS.map((sector) => (
                  <option key={sector} value={sector} />
                ))}
              </datalist>
              <ActivityDomainsChecklist
                selected={selectedActivityDomains}
                onChange={setSelectedActivityDomains}
              />
              <Field
                name="civility"
                label="Civilité"
                placeholder="Ex: M., Mme..."
                description="Civilité du contact (si renseignée dans le fichier Excel)."
                list="lead-civility-options"
              />
              <datalist id="lead-civility-options">
                {DEFAULT_CIVILITIES.map((civ) => (
                  <option key={civ} value={civ} />
                ))}
              </datalist>
              <Field
                name="notes"
                label="Notes"
                placeholder="Observations ou commentaires sur le lead"
                description="Ces notes pourront aussi venir de la colonne 'observation' de l'Excel."
              />

              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[11px] text-gray-500">Statut</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-full text-[11px] bg-gray-100 text-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-full text-[11px] bg-primary text-white shadow-neu disabled:opacity-60"
                >
                  {loading ? "En cours..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </NeumoCard>
        </div>
      </div>
    </div>
  );
}
