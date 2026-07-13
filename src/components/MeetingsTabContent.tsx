"use client";

import { useState, type FormEvent } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Pencil,
  RotateCcw,
} from "lucide-react";
import type { Activity } from "./InteractionHistory";
import {
  buildMeetingContent,
  parseMeetingContent,
} from "@/lib/meeting-content";

interface MeetingReschedule {
  id: string;
  previousDate: string;
  newDate: string;
  reason: string | null;
  createdAt: string;
  changedBy?: { name: string };
}

interface MeetingsTabContentProps {
  meetings: Activity[];
  loading: boolean;
  leadId: string;
  leadName: string;
  onCreateSuccess?: (activity: Activity) => void;
  onRescheduleSuccess?: (activity: Activity) => void;
  onUpdateSuccess?: (activity: Activity) => void;
}

function formatMeetingDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocalValue(date: string | Date): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PanelMode = "reschedule" | "edit" | "report" | null;

export default function MeetingsTabContent({
  meetings,
  loading,
  leadId,
  leadName,
  onCreateSuccess,
  onRescheduleSuccess,
  onUpdateSuccess,
}: MeetingsTabContentProps) {
  const notifyUpdate = onUpdateSuccess ?? onRescheduleSuccess;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [panelSubmitting, setPanelSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [reportText, setReportText] = useState("");

  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyByActivity, setHistoryByActivity] = useState<
    Record<string, MeetingReschedule[]>
  >({});
  const [rescheduleCounts, setRescheduleCounts] = useState<
    Record<string, number>
  >({});

  const closePanel = () => {
    setPanelId(null);
    setPanelMode(null);
    setPanelError(null);
    setNewDate("");
    setReason("");
    setEditTitle("");
    setEditLocation("");
    setEditNotes("");
    setReportText("");
  };

  const openPanel = (meeting: Activity, mode: Exclude<PanelMode, null>) => {
    if (panelId === meeting.id && panelMode === mode) {
      closePanel();
      return;
    }
    setShowForm(false);
    setPanelId(meeting.id);
    setPanelMode(mode);
    setPanelError(null);

    const parsed = parseMeetingContent(meeting.content);
    if (mode === "reschedule") {
      setNewDate(toDatetimeLocalValue(meeting.date));
      setReason("");
    } else if (mode === "edit") {
      setEditTitle(parsed.title);
      setEditLocation(parsed.location);
      setEditNotes(parsed.notes);
    } else {
      setReportText("");
    }
  };

  const toggleHistory = async (activityId: string) => {
    if (historyId === activityId) {
      setHistoryId(null);
      return;
    }
    setHistoryId(activityId);
    setHistoryError(null);
    if (historyByActivity[activityId]) return;

    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/activities/${encodeURIComponent(activityId)}/reschedules`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Impossible de charger l'historique");
      }
      const items = (await res.json()) as MeetingReschedule[];
      setHistoryByActivity((prev) => ({ ...prev, [activityId]: items }));
      setRescheduleCounts((prev) => ({ ...prev, [activityId]: items.length }));
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Erreur inattendue",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const patchMeeting = async (
    meetingId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `/api/activities/${encodeURIComponent(meetingId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Impossible de mettre à jour le rendez-vous");
    }
    return (await res.json()) as Activity & { rescheduleCount?: number };
  };

  const handleReschedule = async (e: FormEvent, meeting: Activity) => {
    e.preventDefault();
    if (!newDate) {
      setPanelError("Merci de renseigner la nouvelle date.");
      return;
    }
    const parsed = new Date(newDate);
    if (Number.isNaN(parsed.getTime())) {
      setPanelError("Date invalide.");
      return;
    }
    if (parsed.getTime() === new Date(meeting.date).getTime()) {
      setPanelError("La nouvelle date doit être différente.");
      return;
    }

    setPanelSubmitting(true);
    setPanelError(null);
    try {
      const updated = await patchMeeting(meeting.id, {
        action: "reschedule",
        date: newDate,
        reason: reason.trim() || undefined,
      });
      onRescheduleSuccess?.(updated);
      if (typeof updated.rescheduleCount === "number") {
        setRescheduleCounts((prev) => ({
          ...prev,
          [meeting.id]: updated.rescheduleCount!,
        }));
      }
      setHistoryByActivity((prev) => {
        const next = { ...prev };
        delete next[meeting.id];
        return next;
      });
      if (historyId === meeting.id) setHistoryId(null);
      closePanel();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPanelSubmitting(false);
    }
  };

  const handleEdit = async (e: FormEvent, meeting: Activity) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setPanelError("Le titre est obligatoire.");
      return;
    }
    setPanelSubmitting(true);
    setPanelError(null);
    try {
      const updated = await patchMeeting(meeting.id, {
        action: "update",
        title: editTitle.trim(),
        location: editLocation.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      notifyUpdate?.(updated);
      closePanel();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPanelSubmitting(false);
    }
  };

  const handleAddReport = async (e: FormEvent, meeting: Activity) => {
    e.preventDefault();
    if (!reportText.trim()) {
      setPanelError("Merci de saisir le rapport d'échange.");
      return;
    }
    setPanelSubmitting(true);
    setPanelError(null);
    try {
      const updated = await patchMeeting(meeting.id, {
        action: "add_report",
        report: reportText.trim(),
      });
      notifyUpdate?.(updated);
      closePanel();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPanelSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!meetingDate) {
      setError("Merci de renseigner la date du rendez-vous.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const content = buildMeetingContent({
        title,
        location,
        notes,
      });
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MEETING",
          content,
          leadId,
          date: meetingDate,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Impossible de créer le rendez-vous");
      }
      const created = (await res.json()) as Activity;
      onCreateSuccess?.(created);
      setTitle("");
      setNotes("");
      setMeetingDate("");
      setLocation("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleNotes = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const renderMeetingCard = (m: Activity, variant: "upcoming" | "history") => {
    const parsed = parseMeetingContent(m.content);
    const previewParts = [
      parsed.location ? `Lieu: ${parsed.location}` : "",
      parsed.notes,
    ].filter(Boolean);
    const previewNotes = previewParts.join("\n");
    const count = rescheduleCounts[m.id] ?? 0;
    const isPanelOpen = panelId === m.id;
    const isHistoryOpen = historyId === m.id;

    return (
      <div
        key={m.id}
        className={`rounded-2xl bg-white border shadow-neu flex flex-col gap-1.5 p-3 text-[11px] text-gray-700 ${
          variant === "upcoming" ? "border-gray-100" : "border-gray-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {variant === "upcoming" ? (
              <span className="w-5 h-5 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-3 h-3" />
              </span>
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0 text-gray-400" />
            )}
            <span className="font-medium truncate">{parsed.title}</span>
            {count > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-medium">
                Reporté {count > 1 ? `${count}×` : ""}
              </span>
            )}
            {parsed.reports.length > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-medium">
                {parsed.reports.length} rapport
                {parsed.reports.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">
            {formatMeetingDate(m.date)}
          </span>
        </div>

        {previewNotes && (
          <>
            <p
              className={`text-[11px] text-gray-600 whitespace-pre-line ${
                expandedIds.includes(m.id) ? "" : "line-clamp-2"
              }`}
            >
              {previewNotes}
            </p>
            {previewNotes.length > 120 && (
              <button
                type="button"
                onClick={() => toggleNotes(m.id)}
                className="mt-0.5 text-[10px] text-primary hover:underline self-start"
              >
                {expandedIds.includes(m.id) ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </>
        )}

        {parsed.reports.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-medium text-gray-500">
              Rapports d&apos;échange
            </span>
            {parsed.reports.map((report, idx) => (
              <div
                key={`${m.id}-report-${idx}`}
                className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-2.5 py-2 flex flex-col gap-0.5"
              >
                <span className="text-[9px] text-emerald-700 font-medium">
                  {report.meta}
                </span>
                <p className="text-[10px] text-gray-700 whitespace-pre-line">
                  {report.body}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => openPanel(m, "edit")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 hover:text-primary hover:border-primary/20"
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
          <button
            type="button"
            onClick={() => openPanel(m, "report")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 hover:text-primary hover:border-primary/20"
          >
            <FileText className="w-3 h-3" />
            Rapport d&apos;échange
          </button>
          <button
            type="button"
            onClick={() => openPanel(m, "reschedule")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 hover:text-primary hover:border-primary/20"
          >
            <RotateCcw className="w-3 h-3" />
            Reporter
          </button>
          <button
            type="button"
            onClick={() => toggleHistory(m.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 hover:text-primary hover:border-primary/20"
          >
            <History className="w-3 h-3" />
            Historique des reports
          </button>
        </div>

        {isPanelOpen && panelMode === "edit" && (
          <form
            onSubmit={(e) => handleEdit(e, m)}
            className="mt-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2"
          >
            <span className="text-[10px] font-medium text-primary">
              Modifier le rendez-vous
            </span>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre"
              className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Lieu (optionnel)"
              className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notes..."
              className="min-h-[70px] rounded-xl border border-gray-200 px-3 py-2 text-[11px] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {panelError && (
              <p className="text-[10px] text-rose-500">{panelError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={panelSubmitting}
                className="px-4 py-1.5 rounded-full bg-primary text-white text-[11px] shadow-neu disabled:opacity-60"
              >
                {panelSubmitting ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {isPanelOpen && panelMode === "report" && (
          <form
            onSubmit={(e) => handleAddReport(e, m)}
            className="mt-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2"
          >
            <span className="text-[10px] font-medium text-primary">
              Nouveau rapport d&apos;échange
            </span>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Compte-rendu de l'échange, décisions, prochaines étapes..."
              className="min-h-[90px] rounded-xl border border-gray-200 px-3 py-2 text-[11px] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {panelError && (
              <p className="text-[10px] text-rose-500">{panelError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={panelSubmitting}
                className="px-4 py-1.5 rounded-full bg-primary text-white text-[11px] shadow-neu disabled:opacity-60"
              >
                {panelSubmitting ? "Enregistrement..." : "Ajouter le rapport"}
              </button>
            </div>
          </form>
        )}

        {isPanelOpen && panelMode === "reschedule" && (
          <form
            onSubmit={(e) => handleReschedule(e, m)}
            className="mt-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2"
          >
            <span className="text-[10px] font-medium text-primary">
              Reporter ce rendez-vous
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-600">Nouvelle date & heure</span>
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-600">Motif (optionnel)</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: indisponibilité du client..."
                className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            {panelError && (
              <p className="text-[10px] text-rose-500">{panelError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePanel}
                className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={panelSubmitting}
                className="px-4 py-1.5 rounded-full bg-primary text-white text-[11px] shadow-neu disabled:opacity-60"
              >
                {panelSubmitting ? "Enregistrement..." : "Confirmer"}
              </button>
            </div>
          </form>
        )}

        {isHistoryOpen && (
          <div className="mt-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2">
            <span className="text-[10px] font-medium text-gray-600">
              Historique des reports
            </span>
            {historyLoading && !historyByActivity[m.id] ? (
              <p className="text-[10px] text-gray-400">Chargement...</p>
            ) : historyError && !historyByActivity[m.id] ? (
              <p className="text-[10px] text-rose-500">{historyError}</p>
            ) : !(historyByActivity[m.id]?.length) ? (
              <p className="text-[10px] text-gray-400">
                Aucun report pour ce rendez-vous.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {historyByActivity[m.id].map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-white border border-gray-100 px-2.5 py-2 flex flex-col gap-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-700">
                      <span className="text-gray-400">
                        {formatMeetingDate(item.previousDate)}
                      </span>
                      <span className="text-gray-300">→</span>
                      <span className="font-medium text-primary">
                        {formatMeetingDate(item.newDate)}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-400">
                      {item.changedBy?.name ?? "Utilisateur"} ·{" "}
                      {formatMeetingDate(item.createdAt)}
                    </div>
                    {item.reason && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {item.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  const upcoming = meetings[0] ? [meetings[0]] : [];
  const history = meetings.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-600 w-fit"
        >
          <span>Tous les utilisateurs</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            closePanel();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium shadow-neu"
        >
          Créer un rendez-vous
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-2 text-[11px]"
        >
          <div className="flex items-center gap-2 text-primary font-medium">
            <Calendar className="w-4 h-4" />
            Nouveau rendez-vous pour {leadName}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du rendez-vous"
            className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-gray-600">Date & heure</span>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-gray-600">Lieu du rendez-vous</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Bureaux, Visio, Adresse..."
                className="h-8 rounded-xl border border-gray-200 px-3 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes supplémentaires..."
            className="min-h-[80px] rounded-xl border border-gray-200 px-3 py-2 text-[11px] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {error && <p className="text-[10px] text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setTitle("");
                setNotes("");
                setError(null);
              }}
              className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[11px]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-full bg-primary text-white text-[11px] shadow-neu disabled:opacity-60"
            >
              {submitting ? "Création..." : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-[11px] text-gray-400">Chargement...</p>
        ) : !meetings.length ? (
          <p className="text-[11px] text-gray-400">
            Aucun rendez-vous pour l&apos;instant. Créez un premier rendez-vous.
          </p>
        ) : (
          <>
            {!!upcoming.length && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-medium text-gray-500">
                  Prochains rendez-vous
                </h4>
                {upcoming.map((m) => renderMeetingCard(m, "upcoming"))}
              </div>
            )}

            {!!history.length && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-medium text-gray-500">
                  Historique des rendez-vous
                </h4>
                {history.map((m) => renderMeetingCard(m, "history"))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
