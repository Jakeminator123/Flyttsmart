/**
 * PTS Broadband Import Script
 *
 * Downloads and parses PTS broadband statistics (Excel) into a JSON lookup
 * file at data/pts-broadband.json. Run manually or via cron — NOT at request time.
 *
 * Usage:
 *   npx tsx scripts/pts-import.ts
 *   npx tsx scripts/pts-import.ts --file path/to/pts-data.xlsx
 *
 * The script attempts to download from PTS statistikportal if no --file is given.
 * If download fails, place the Excel manually and use --file.
 */

import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.resolve(__dirname, "../data/pts-broadband.json");

const PTS_DOWNLOAD_URLS = [
  "https://statistik.pts.se/media/b2rhdc1g/tabellbilaga-teknik-1-1.xlsx",
  "https://statistik.pts.se/media/ahnbtnjf/tabellbilaga-hastighet-1-1.xlsx",
];

interface MunicipalityBroadband {
  municipality: string;
  municipalityCode?: string;
  fiberPercent: number | null;
  technologies: string[];
  topOperators: string[];
  householdsTotal: number | null;
  householdsWithBroadband: number | null;
}

type OutputData = {
  generatedAt: string;
  source: string;
  municipalities: Record<string, MunicipalityBroadband>;
};

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .trim();
}

function findColumnIndex(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const idx = headers.findIndex((h) =>
      h.toLowerCase().includes(lower)
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

function parsePercent(val: unknown): number | null {
  if (typeof val === "number") {
    return val > 1 ? Math.round(val * 10) / 10 : Math.round(val * 1000) / 10;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(",", ".").replace("%", "").trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num > 1 ? Math.round(num * 10) / 10 : Math.round(num * 1000) / 10;
  }
  return null;
}

function parseNumber(val: unknown): number | null {
  if (typeof val === "number") return Math.round(val);
  if (typeof val === "string") {
    const num = parseInt(val.replace(/\s/g, ""), 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

async function downloadExcel(): Promise<Buffer | null> {
  for (const url of PTS_DOWNLOAD_URLS) {
    try {
      console.warn(`Trying to download from: ${url}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { "User-Agent": "Flytt.io/1.0 (PTS broadband import)" },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.warn(`Downloaded ${(buf.length / 1024).toFixed(0)} KB from ${url}`);
        return buf;
      }
      console.warn(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      console.warn(`Failed to download from ${url}:`, err);
    }
  }
  return null;
}

/**
 * PTS "Teknik kommun hushåll" sheet has these technology columns (coverage as decimals 0–1):
 *  - Tillgång via xDSL
 *  - Tillgång via VDSL
 *  - Tillgång via fiber eller fiber-lan
 *  - I närhet av fiber
 *  - Tillgång via kabel-tv
 *  - Tillgång via fast radio
 *  - Tillgång via LTE (ej 450 MHz)
 *  - Tillgång via NR (5G)
 *  - Tillgång via trådbunden accessteknik
 *  - Total tillgång (trådbunden och trådlös accessteknik)
 */
const TECH_COLUMNS: { pattern: string; label: string }[] = [
  { pattern: "fiber eller fiber", label: "Fiber" },
  { pattern: "xdsl", label: "xDSL" },
  { pattern: "kabel-tv", label: "Kabel-TV" },
  { pattern: "fast radio", label: "Fast radio" },
  { pattern: "lte", label: "Mobilt (LTE)" },
  { pattern: "nr (5g)", label: "5G (NR)" },
];

async function parseExcel(buffer: Buffer): Promise<OutputData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Buffer & ArrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const worksheet =
    workbook.worksheets.find((ws) => /kommun.*hush/i.test(ws.name)) ??
    workbook.worksheets.find((ws) => /kommun/i.test(ws.name)) ??
    workbook.worksheets[0];
  if (!worksheet) throw new Error("No worksheets found");
  console.warn(`Using sheet: "${worksheet.name}" (of ${sheetNames.join(", ")})`);

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (_row, _rowNumber) => {
    rows.push(_row.values as unknown[]);
  });
  if (rows.length < 2) throw new Error("Sheet has too few rows");

  // ExcelJS row.values is 1-indexed (index 0 is undefined), so shift each row
  for (let i = 0; i < rows.length; i++) {
    rows[i] = (rows[i] as unknown[]).slice(1);
  }

  const headers = (rows[0] as string[]).map((h) => String(h ?? "").trim());
  console.warn(`Headers (${headers.length}): ${headers.join(" | ")}`);

  const municipalityCol = findColumnIndex(headers, "kommunnamn", "kommun");
  const yearCol = findColumnIndex(headers, "årtal", "år", "year");
  const householdsCol = findColumnIndex(headers, "antal hushåll", "hushåll");
  const fiberCol = findColumnIndex(headers, "fiber eller fiber");
  const totalCol = findColumnIndex(headers, "total tillgång");
  const areaCodeCol = findColumnIndex(headers, "område", "kommunkod");

  const techColMap: { colIdx: number; label: string }[] = [];
  for (const tc of TECH_COLUMNS) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(tc.pattern));
    if (idx !== -1) techColMap.push({ colIdx: idx, label: tc.label });
  }

  console.warn(`Municipality col: ${municipalityCol}, Year col: ${yearCol}, Fiber col: ${fiberCol}`);
  console.warn(`Tech columns mapped: ${techColMap.map((t) => `${t.label}@${t.colIdx}`).join(", ")}`);

  // Find the latest year in the data
  let latestYear = 0;
  if (yearCol !== -1) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const y = parseNumber(row?.[yearCol]);
      if (y && y > latestYear) latestYear = y;
    }
  }
  console.warn(`Latest year in data: ${latestYear || "unknown"}`);

  const municipalities: Record<string, MunicipalityBroadband> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;

    // Filter to latest year only
    if (yearCol !== -1 && latestYear > 0) {
      const rowYear = parseNumber(row[yearCol]);
      if (rowYear !== latestYear) continue;
    }

    const rawName = municipalityCol !== -1
      ? String(row[municipalityCol] ?? "").trim()
      : "";
    if (!rawName || /^\d+$/.test(rawName) || rawName.toLowerCase() === "riket") continue;

    const key = normalizeKey(rawName);
    if (!key) continue;

    // Parse technology coverage percentages
    const technologies: string[] = [];
    for (const tc of techColMap) {
      const pct = parsePercent(row[tc.colIdx]);
      if (pct !== null && pct > 5) {
        technologies.push(`${tc.label} (${pct}%)`);
      }
    }

    const fiberPct = fiberCol !== -1 ? parsePercent(row[fiberCol]) : null;
    const totalPct = totalCol !== -1 ? parsePercent(row[totalCol]) : null;
    const households = householdsCol !== -1 ? parseNumber(row[householdsCol]) : null;
    const areaCode = areaCodeCol !== -1 ? String(row[areaCodeCol] ?? "").trim() : undefined;

    municipalities[key] = {
      municipality: rawName,
      municipalityCode: areaCode && /^\d+$/.test(areaCode) ? areaCode : undefined,
      fiberPercent: fiberPct,
      technologies,
      topOperators: [],
      householdsTotal: households,
      householdsWithBroadband: totalPct !== null && households !== null
        ? Math.round(households * totalPct / 100)
        : null,
    };
  }

  console.warn(`Parsed ${Object.keys(municipalities).length} municipalities (year ${latestYear})`);

  return {
    generatedAt: new Date().toISOString(),
    source: `PTS bredbandskartläggning ${latestYear || ""}`.trim(),
    municipalities,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const filePath = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

  let buffer: Buffer;

  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    buffer = fs.readFileSync(resolved);
    console.warn(`Reading local file: ${resolved} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } else {
    const downloaded = await downloadExcel();
    if (!downloaded) {
      console.error(
        "Could not download PTS data. Place the Excel file manually and run:\n" +
        "  npx tsx scripts/pts-import.ts --file path/to/pts-data.xlsx"
      );
      process.exit(1);
    }
    buffer = downloaded;
  }

  const data = await parseExcel(buffer);

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.warn(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
