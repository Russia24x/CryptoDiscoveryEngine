/**
 * Export utilities for watchlist and scan results.
 * Generates CSV and JSON files and triggers browser download.
 */

/** Trigger a browser download of a text file. */
function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert array of objects to CSV string. */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

interface WatchlistExportRow {
  symbol: string;
  name: string;
  category: string;
  iaFinal: string;
  decision: string;
  changePct7d: string;
}

/** Export watchlist as CSV. */
export function exportWatchlistCSV(rows: WatchlistExportRow[]) {
  const csv = toCSV(rows as unknown as Record<string, unknown>[]);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`cryptoSieve-watchlist-${date}.csv`, csv, "text/csv;charset=utf-8");
}

/** Export watchlist as JSON. */
export function exportWatchlistJSON(rows: WatchlistExportRow[]) {
  const json = JSON.stringify(rows, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`cryptoSieve-watchlist-${date}.json`, json, "application/json");
}

interface ScanExportRow {
  rankMkt: number;
  symbol: string;
  name: string;
  category: string;
  iaRaw: string;
  iaEffective: string;
  iaFinal: string;
  confidence: string;
  decision: string;
  gatePassed: string;
}

/** Export scan results as CSV. */
export function exportScanCSV(rows: ScanExportRow[]) {
  const csv = toCSV(rows as unknown as Record<string, unknown>[]);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`cryptoSieve-scan-${date}.csv`, csv, "text/csv;charset=utf-8");
}

/** Export scan results as JSON. */
export function exportScanJSON(rows: ScanExportRow[]) {
  const json = JSON.stringify(rows, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`cryptoSieve-scan-${date}.json`, json, "application/json");
}
