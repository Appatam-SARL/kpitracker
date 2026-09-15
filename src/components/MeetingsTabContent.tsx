"use client";

import { useState, type FormEvent } from "react";
import { Calendar, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import type { Activity } from "./InteractionHistory";

interface MeetingsTabContentProps {
  meetings: Activity[];
  loading: boolean;
  leadId: string;
  contactId?: string;
  leadName: string;
  onCreateSuccess?: (activity: Activity) => void;
}

function parseMeetingContent(content: string): { title: string; notes: string } {
  const match = content.match(/^Titre:\s*(.+?)(?:\n\n|$)/);
  if (match) {
    return {
      title: match[1].trim(),
      notes: content.replace(/^Titre:\s*.+?(?:\n\n)?/, "").trim(),
    };
  }
  return { title: "Rendez-vous", notes: content };
}

export default function MeetingsTabContent({
  meetings,
  loading,
  leadId,
  contactId,
  leadName,
  onCreateSuccess,
}: MeetingsTabContentProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

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
      const content = `Titre: ${title}${
        location ? `\n\nLieu: ${location}` : ""
      }${notes ? `\n\n${notes}` : ""}`;
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MEETING",
          content,
          leadId,
          contactId: contactId || undefined,
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
          onClick={() => setShowForm(true)}
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
              onClick={() => { setShowForm(false); setTitle(""); setNotes(""); setError(null); }}
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

      <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-[11px] text-gray-400">Chargement...</p>
        ) : !meetings.length ? (
          <p className="text-[11px] text-gray-400">
            Aucun rendez-vous pour l'instant. Créez un premier rendez-vous.
          </p>
        ) : (
          <>
            {!!upcoming.length && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-medium text-gray-500">Prochains rendez-vous</h4>
                {upcoming.map((m) => {
                  const { title, notes } = parseMeetingContent(m.content);
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-white border border-gray-100 shadow-neu flex flex-col gap-1.5 p-3 text-[11px] text-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Calendar className="w-3 h-3" />
                          </span>
                          <span className="font-medium">{title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(m.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                    </div>
                      {notes && (
                        <>
                          <p
                            className={`text-[11px] text-gray-600 ${
                              expandedIds.includes(m.id) ? "" : "line-clamp-2"
                            }`}
                          >
                            {notes}
                          </p>
                          {notes.length > 120 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((prev) =>
                                  prev.includes(m.id)
                                    ? prev.filter((id) => id !== m.id)
                                    : [...prev, m.id],
                                )
                              }
                              className="mt-0.5 text-[10px] text-primary hover:underline self-start"
                            >
                              {expandedIds.includes(m.id) ? "Voir moins" : "Voir plus"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!!history.length && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-medium text-gray-500">Historique des rendez-vous</h4>
                {history.map((m) => {
                  const { title, notes } = parseMeetingContent(m.content);
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-white border border-gray-50 shadow-neu flex flex-col gap-1.5 p-3 text-[11px] text-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className="font-medium">{title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {new Date(m.date).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded-full bg-gray-50 text-gray-400 hover:text-primary"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {notes && (
                        <>
                          <p
                            className={`text-[11px] text-gray-600 ${
                              expandedIds.includes(m.id) ? "" : "line-clamp-2"
                            }`}
                          >
                            {notes}
                          </p>
                          {notes.length > 120 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((prev) =>
                                  prev.includes(m.id)
                                    ? prev.filter((id) => id !== m.id)
                                    : [...prev, m.id],
                                )
                              }
                              className="mt-0.5 text-[10px] text-primary hover:underline self-start"
                            >
                              {expandedIds.includes(m.id) ? "Voir moins" : "Voir plus"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
