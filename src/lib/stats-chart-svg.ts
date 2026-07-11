type ChartSeries = {
  label: string;
  values: number[];
  color: string;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateLabel(label: string, max = 14): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

export function renderGaugeSvg(
  percent: number,
  title: string,
  width = 320,
  height = 220,
): string {
  const pct = Math.max(0, Math.min(100, percent));
  const cx = width / 2;
  const cy = height * 0.62;
  const r = Math.min(width, height) * 0.32;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const valueAngle = startAngle + (pct / 100) * Math.PI;

  const polar = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const start = polar(startAngle);
  const end = polar(endAngle);
  const value = polar(valueAngle);
  const largeArc = pct > 50 ? 1 : 0;

  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  const valuePath =
    pct <= 0
      ? ''
      : `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${value.x} ${value.y}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="${cx}" y="28" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#1e3a5f">${escapeXml(title)}</text>
  <path d="${trackPath}" fill="none" stroke="#cbd5e1" stroke-width="18" stroke-linecap="round"/>
  ${valuePath ? `<path d="${valuePath}" fill="none" stroke="#2563eb" stroke-width="18" stroke-linecap="round"/>` : ''}
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#1e40af">${pct.toFixed(0)}%</text>
</svg>`;
}

export function renderColumnChartSvg(
  categories: string[],
  series: ChartSeries[],
  title: string,
  width = 640,
  height = 320,
): string {
  const padding = { top: 44, right: 24, bottom: 56, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => s.values),
    ...categories.map((_, i) =>
      series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
    ),
  );

  const groupWidth = chartW / Math.max(categories.length, 1);
  const barGap = 6;
  const barWidth =
    (groupWidth - barGap * (series.length + 1)) / Math.max(series.length, 1);

  const bars: string[] = [];
  const labels: string[] = [];

  categories.forEach((cat, i) => {
    const gx = padding.left + i * groupWidth;
    labels.push(
      `<text x="${gx + groupWidth / 2}" y="${height - 18}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#475569">${escapeXml(truncateLabel(cat))}</text>`,
    );
    series.forEach((s, si) => {
      const val = s.values[i] ?? 0;
      const h = (val / maxVal) * chartH;
      const x = gx + barGap + si * (barWidth + barGap);
      const y = padding.top + chartH - h;
      bars.push(
        `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${s.color}" rx="2"/>`,
      );
      if (val > 0 && categories.length <= 12) {
        bars.push(
          `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#334155">${val.toLocaleString('fr-FR')}</text>`,
        );
      }
    });
  });

  const legend = series
    .map(
      (s, i) =>
        `<rect x="${padding.left + i * 140}" y="12" width="12" height="12" fill="${s.color}" rx="2"/>
         <text x="${padding.left + i * 140 + 18}" y="22" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#334155">${escapeXml(s.label)}</text>`,
    )
    .join('');

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + chartH * (1 - ratio);
      const val = Math.round(maxVal * ratio);
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#64748b">${val.toLocaleString('fr-FR')}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${padding.left}" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="#1e3a5f">${escapeXml(title)}</text>
  ${legend}
  ${gridLines}
  ${bars.join('')}
  ${labels.join('')}
</svg>`;
}

export function renderDonutSvg(
  labels: string[],
  values: number[],
  title: string,
  width = 360,
  height = 300,
): string {
  const total = values.reduce((s, v) => s + v, 0);
  const colors = [
    '#2563eb',
    '#0ea5e9',
    '#14b8a6',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#64748b',
    '#22c55e',
  ];
  const cx = width * 0.38;
  const cy = height * 0.52;
  const outerR = Math.min(width, height) * 0.28;
  const innerR = outerR * 0.58;

  let angle = -Math.PI / 2;
  const slices: string[] = [];
  const legend: string[] = [];

  if (total <= 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#64748b">Aucune donnée</text>
    </svg>`;
  }

  values.forEach((val, i) => {
    const slice = (val / total) * Math.PI * 2;
    const end = angle + slice;
    const x1 = cx + outerR * Math.cos(angle);
    const y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const xi1 = cx + innerR * Math.cos(end);
    const yi1 = cy + innerR * Math.sin(end);
    const xi2 = cx + innerR * Math.cos(angle);
    const yi2 = cy + innerR * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];
    slices.push(
      `<path d="M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z" fill="${color}"/>`,
    );
    angle = end;
    const pct = ((val / total) * 100).toFixed(1);
    legend.push(
      `<rect x="${width * 0.62}" y="${48 + i * 22}" width="10" height="10" fill="${color}" rx="2"/>
       <text x="${width * 0.62 + 16}" y="${57 + i * 22}" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#334155">${escapeXml(truncateLabel(labels[i] ?? '', 18))} (${pct}%)</text>`,
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${cx}" y="28" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#1e3a5f">${escapeXml(title)}</text>
  ${slices.join('')}
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#1e40af">${total.toLocaleString('fr-FR')}</text>
  ${legend.join('')}
</svg>`;
}

export async function svgToPngBuffer(svg: string): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
