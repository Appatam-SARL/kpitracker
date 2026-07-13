export type MeetingReport = {
  /** Ex. "13 juil. 2026, 15:30 · Jean Dupont" */
  meta: string;
  body: string;
};

export type ParsedMeetingContent = {
  title: string;
  location: string;
  notes: string;
  reports: MeetingReport[];
};

const REPORT_PREFIX = "--- Rapport d'échange · ";

/** Extrait le titre d'un contenu de rendez-vous (format `Titre: …`). */
export function parseMeetingTitle(content: string): string {
  return parseMeetingContent(content).title;
}

export function parseMeetingContent(content: string): ParsedMeetingContent {
  const parts = content.split(
    new RegExp(`\\n(?=${escapeRegExp(REPORT_PREFIX)})`),
  );
  const main = (parts[0] ?? content).trim();
  const reports: MeetingReport[] = [];

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const match = block.match(
      /^--- Rapport d'échange · (.+?) ---\n?([\s\S]*)$/,
    );
    if (match) {
      reports.push({ meta: match[1].trim(), body: match[2].trim() });
    }
  }

  const lines = main.split(/\r?\n/);
  let title = "Rendez-vous";
  let location = "";
  const noteLines: string[] = [];

  let i = 0;
  if (lines[0]?.match(/^Titre:\s*/i)) {
    title = lines[0].replace(/^Titre:\s*/i, "").trim() || title;
    i = 1;
    if (lines[i] === "") i += 1;
  }

  if (lines[i]?.match(/^Lieu:\s*/i)) {
    location = lines[i].replace(/^Lieu:\s*/i, "").trim();
    i += 1;
    if (lines[i] === "") i += 1;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    // Ignore les doublons de lieu déjà extrait (ex. "Lieu: Plateau" ou "Plateau")
    if (location) {
      const asLieu = line.match(/^Lieu:\s*(.+)$/i)?.[1]?.trim();
      if (asLieu && asLieu.toLowerCase() === location.toLowerCase()) continue;
      if (line.trim().toLowerCase() === location.toLowerCase()) continue;
    }
    if (line.match(/^Lieu:\s*/i) && !location) {
      location = line.replace(/^Lieu:\s*/i, "").trim();
      continue;
    }
    noteLines.push(line);
  }

  const notes = noteLines.join("\n").trim();

  return { title, location, notes, reports };
}

export function buildMeetingContent(parts: {
  title: string;
  location?: string;
  notes?: string;
  reports?: MeetingReport[];
}): string {
  const location = parts.location?.trim() ?? "";
  // Évite de réécrire le lieu dans les notes
  let notes = (parts.notes ?? "").trim();
  if (location && notes) {
    notes = notes
      .split(/\r?\n/)
      .filter((line) => {
        const asLieu = line.match(/^Lieu:\s*(.+)$/i)?.[1]?.trim();
        if (asLieu && asLieu.toLowerCase() === location.toLowerCase()) {
          return false;
        }
        if (line.trim().toLowerCase() === location.toLowerCase()) return false;
        return true;
      })
      .join("\n")
      .trim();
  }

  let content = `Titre: ${parts.title.trim()}`;
  if (location) {
    content += `\n\nLieu: ${location}`;
  }
  if (notes) {
    content += `\n\n${notes}`;
  }
  for (const report of parts.reports ?? []) {
    content += `\n\n${REPORT_PREFIX}${report.meta} ---\n${report.body.trim()}`;
  }
  return content;
}

export function appendMeetingReport(
  content: string,
  reportBody: string,
  authorName: string,
  at: Date = new Date(),
): string {
  const parsed = parseMeetingContent(content);
  const meta = `${formatMeetingMetaDate(at)} · ${authorName}`;
  return buildMeetingContent({
    ...parsed,
    reports: [...parsed.reports, { meta, body: reportBody.trim() }],
  });
}

function formatMeetingMetaDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
