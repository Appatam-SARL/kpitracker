"use client";

import { useState, type FormEvent } from "react";
import NeumoCard from "./NeumoCard";
import { Field } from "./ui/field";

interface ServiceCreateSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (service: { id: string; name: string }) => void;
  companyId?: string;
}

export default function ServiceCreateSheet({
  open,
  onClose,
  onCreated,
  companyId,
}: ServiceCreateSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) {
      setError("Le nom est requis.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(companyId ? { companyId } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Impossible de créer le service");
      }

      const created = await res.json();
      onCreated?.(created);
      form.reset();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm">
      <div
        className="h-full w-full max-w-md bg-transparent p-4"
        onClick={onClose}
      >
        <div
          className="h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <NeumoCard className="h-full max-h-[90vh] overflow-auto bg-white p-5 flex flex-col gap-4 shadow-neu-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Ajouter un service
                </h2>
                <p className="text-[11px] text-gray-500">
                  Enregistrez un service de l&apos;entreprise.
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

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 text-xs text-gray-700"
            >
              <Field
                name="name"
                label="Nom du service"
                placeholder="Ex: Conseil stratégique"
                required
              />

              {error && (
                <p className="text-[11px] text-rose-500 mt-1">{error}</p>
              )}

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
