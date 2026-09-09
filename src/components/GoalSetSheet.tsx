"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PERIOD_TYPES = [
  { value: "MONTH" as const, label: "Mois" },
  { value: "QUARTER" as const, label: "Trimestre" },
  { value: "SEMESTER" as const, label: "Semestre" },
  { value: "YEAR" as const, label: "Annuelle" },
];

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export type ExistingGoalForEdit = {
  id: string;
  periodType: "MONTH" | "QUARTER" | "SEMESTER" | "YEAR";
  periodStart: string;
  periodLabel?: string;
  targetConversions: number;
  targetRevenue: number;
};

interface GoalSetSheetProps {
  open: boolean;
  user: { id: string; name: string; role: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  mode?: "create" | "edit";
  existingGoal?: ExistingGoalForEdit | null;
  /** Périmètre groupe : masque le message « votre entreprise ». */
  crossCompanyScope?: boolean;
}

function periodFromStart(
  periodType: ExistingGoalForEdit["periodType"],
  periodStart: string,
): { year: number; month: number; quarter: number; semester: number } {
  const d = new Date(periodStart);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const semester = month <= 6 ? 1 : 2;
  return { year, month, quarter, semester };
}

export function GoalSetSheet({
  open,
  user,
  onOpenChange,
  onSaved,
  mode = "create",
  existingGoal = null,
  crossCompanyScope = false,
}: GoalSetSheetProps) {
  const currentYear = new Date().getFullYear();
  const isEdit = mode === "edit" && existingGoal != null;
  const [periodType, setPeriodType] = useState<"MONTH" | "QUARTER" | "SEMESTER" | "YEAR">("MONTH");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(1);
  const [semester, setSemester] = useState(1);
  const [targetConversions, setTargetConversions] = useState(0);
  const [targetRevenue, setTargetRevenue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;

    setError(null);

    if (isEdit && existingGoal) {
      const parsed = periodFromStart(existingGoal.periodType, existingGoal.periodStart);
      setPeriodType(existingGoal.periodType);
      setYear(parsed.year);
      setMonth(parsed.month);
      setQuarter(parsed.quarter);
      setSemester(parsed.semester);
      setTargetConversions(existingGoal.targetConversions);
      setTargetRevenue(existingGoal.targetRevenue);
      return;
    }

    setPeriodType("MONTH");
    setYear(currentYear);
    setMonth(new Date().getMonth() + 1);
    setQuarter(Math.floor(new Date().getMonth() / 3) + 1);
    setSemester(new Date().getMonth() < 6 ? 1 : 2);
    setTargetConversions(0);
    setTargetRevenue(0);
  }, [open, user, currentYear, isEdit, existingGoal]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      if (isEdit && existingGoal) {
        const res = await fetch(`/api/goals/${existingGoal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetConversions, targetRevenue }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Impossible de redéfinir l'objectif",
          );
        }
      } else {
        const body: Record<string, unknown> = {
          userId: user.id,
          periodType,
          year,
          targetConversions,
          targetRevenue,
        };
        if (periodType === "MONTH") body.month = month;
        else if (periodType === "QUARTER") body.quarter = quarter;
        else if (periodType === "SEMESTER") body.semester = semester;

        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const apiError =
            typeof data?.error === "string" ? data.error : "";
          if (
            res.status === 403 &&
            (apiError.includes("autre entreprise") ||
              apiError.includes("Utilisateur non trouvé"))
          ) {
            throw new Error(
              "Ce commercial n'appartient pas au périmètre autorisé. Rechargez la page puis réessayez.",
            );
          }
          throw new Error(apiError || "Impossible d'enregistrer l'objectif");
        }
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const title = isEdit ? "Redéfinir l'objectif" : "Définir un objectif";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex flex-col gap-1">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              Objectif pour {user.name} — conversions et CA cible.
            </SheetDescription>
            {isEdit && existingGoal?.periodLabel && (
              <p className="text-[11px] text-gray-500">
                Période en cours : {existingGoal.periodLabel}
              </p>
            )}
            {!crossCompanyScope && !isEdit && (
              <p className="text-[11px] text-gray-500">
                Seuls les commerciaux de votre entreprise peuvent recevoir un
                objectif.
              </p>
            )}
          </div>
          <SheetClose className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center">
            ✕
          </SheetClose>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 text-xs">
          {!isEdit && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-600">Période</span>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPeriodType(value)}
                      className={`px-3 py-1.5 rounded-full border text-[11px] transition-colors ${
                        periodType === value
                          ? "bg-primary text-white border-primary shadow-neu"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-[11px] text-gray-600">Année</span>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>

                {periodType === "MONTH" && (
                  <label className="flex flex-col gap-1 flex-1">
                    <span className="text-[11px] text-gray-600">Mois</span>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {MONTHS.map((label, i) => (
                        <option key={i} value={i + 1}>{label}</option>
                      ))}
                    </select>
                  </label>
                )}

                {periodType === "QUARTER" && (
                  <label className="flex flex-col gap-1 flex-1">
                    <span className="text-[11px] text-gray-600">Trimestre</span>
                    <select
                      value={quarter}
                      onChange={(e) => setQuarter(Number(e.target.value))}
                      className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q} value={q}>Trimestre {q}</option>
                      ))}
                    </select>
                  </label>
                )}

                {periodType === "SEMESTER" && (
                  <label className="flex flex-col gap-1 flex-1">
                    <span className="text-[11px] text-gray-600">Semestre</span>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(Number(e.target.value))}
                      className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value={1}>Semestre 1 (Jan–Juin)</option>
                      <option value={2}>Semestre 2 (Juil–Déc)</option>
                    </select>
                  </label>
                )}
              </div>
            </>
          )}

          <Field
            label="Objectif conversions"
            name="targetConversions"
            type="number"
            min={0}
            value={targetConversions}
            onChange={(e) => setTargetConversions(Number(e.target.value) || 0)}
          />
          <Field
            label="Objectif CA (XOF)"
            name="targetRevenue"
            type="number"
            min={0}
            step={1000}
            value={targetRevenue}
            onChange={(e) => setTargetRevenue(Number(e.target.value) || 0)}
          />

          {error && (
            <p className="text-[11px] text-rose-500">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-neu disabled:opacity-50"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
            <SheetClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs"
              >
                Annuler
              </button>
            </SheetClose>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
