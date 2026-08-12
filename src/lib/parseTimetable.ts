import * as XLSX from "xlsx";
import type { ClassEntry, DayOfWeek } from "../types";
import { sortedByDayThenTime } from "./classes";

export interface SectionGroup {
  prefix: string; // e.g. "CS-", or "Other"
  codes: string[];
}

const DAY_MAP: Record<string, DayOfWeek> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

const CELL_RE = /^(.*?)\s*\(([^)]*)\)\s*(?::\s*(.*))?$/;
const TIME_RE = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/;

interface PeriodRange {
  startCol: number;
  endCol: number;
  startTime: string;
  endTime: string;
}

interface CandidateCell {
  day: DayOfWeek;
  room: string;
  text: string;
  startTime: string;
  endTime: string;
}

interface ParsedCell {
  courseName: string;
  sectionCodes: string[];
  instructor?: string;
}

export function getRelevantSheets(wb: XLSX.WorkBook): string[] {
  if (wb.SheetNames.includes("Combined TT")) return ["Combined TT"];
  return wb.SheetNames.filter((n) => n.endsWith(" TT"));
}

function sheetToRows(wb: XLSX.WorkBook, sheetName: string): string[][] {
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false }) as string[][];
}

function findHeaderRowIndex(rows: string[][]): number {
  return rows.findIndex((row) => (row[0] ?? "").toString().trim() === "Days");
}

function parseTimeRange(label: string): { startTime: string; endTime: string } | null {
  const m = label.match(TIME_RE);
  if (!m) return null;
  const [, sh, sm, eh, em] = m;
  return { startTime: `${sh.padStart(2, "0")}:${sm}`, endTime: `${eh.padStart(2, "0")}:${em}` };
}

function parsePeriodRanges(rows: string[][], headerRowIndex: number): PeriodRange[] {
  if (headerRowIndex <= 0) return [];
  const periodRow = rows[headerRowIndex - 1] ?? [];
  const labels: { col: number; label: string }[] = [];
  for (let c = 2; c < periodRow.length; c++) {
    const text = (periodRow[c] ?? "").toString().trim();
    if (text) labels.push({ col: c, label: text });
  }
  const ranges: PeriodRange[] = [];
  for (let i = 0; i < labels.length; i++) {
    const { col, label } = labels[i];
    const endCol = i + 1 < labels.length ? labels[i + 1].col : col + 9;
    const time = parseTimeRange(label);
    if (!time) continue;
    ranges.push({ startCol: col, endCol, ...time });
  }
  return ranges;
}

function parseDay(text: string): DayOfWeek | null {
  const key = text.trim().toLowerCase().slice(0, 3);
  return DAY_MAP[key] ?? null;
}

function walkCandidates(rows: string[][], headerRowIndex: number, ranges: PeriodRange[]): CandidateCell[] {
  const candidates: CandidateCell[] = [];
  let currentDay: DayOfWeek | null = null;
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const parsedDay = parseDay((row[0] ?? "").toString());
    if (parsedDay) currentDay = parsedDay;
    if (!currentDay) continue;
    const room = (row[1] ?? "").toString().trim();
    for (let c = 2; c < row.length; c++) {
      const text = (row[c] ?? "").toString().trim();
      if (!text) continue;
      const range = ranges.find((rg) => c >= rg.startCol && c < rg.endCol);
      if (!range) continue;
      candidates.push({ day: currentDay, room, text, startTime: range.startTime, endTime: range.endTime });
    }
  }
  return candidates;
}

function expandSectionCodes(group: string): string[] {
  const parts = group
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const dashIdx = parts[0].indexOf("-");
  const prefix = dashIdx >= 0 ? parts[0].slice(0, dashIdx + 1) : "";
  return parts.map((p) => (p.includes("-") ? p : prefix + p));
}

function parseCellText(text: string): ParsedCell | null {
  const m = text.match(CELL_RE);
  if (!m) return null;
  const [, courseName, sectionGroup, instructor] = m;
  return {
    courseName: courseName.trim(),
    sectionCodes: expandSectionCodes(sectionGroup),
    instructor: instructor?.trim() || undefined,
  };
}

function compareCodes(a: string, b: string, prefix: string): number {
  const suffixA = prefix === "Other" ? a : a.slice(prefix.length);
  const suffixB = prefix === "Other" ? b : b.slice(prefix.length);
  const numA = suffixA.match(/^\d+/);
  const numB = suffixB.match(/^\d+/);
  const nA = numA ? parseInt(numA[0], 10) : NaN;
  const nB = numB ? parseInt(numB[0], 10) : NaN;
  if (!isNaN(nA) && !isNaN(nB) && nA !== nB) return nA - nB;
  if (!isNaN(nA) !== !isNaN(nB)) return isNaN(nA) ? 1 : -1;
  const restA = numA ? suffixA.slice(numA[0].length) : suffixA;
  const restB = numB ? suffixB.slice(numB[0].length) : suffixB;
  return restA.localeCompare(restB);
}

function groupSections(codes: string[]): SectionGroup[] {
  const groups = new Map<string, string[]>();
  for (const code of codes) {
    const dashIdx = code.indexOf("-");
    const prefix = dashIdx >= 0 ? code.slice(0, dashIdx + 1) : "Other";
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(code);
  }
  const prefixes = [...groups.keys()].sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
  return prefixes.map((prefix) => ({
    prefix,
    codes: groups.get(prefix)!.sort((a, b) => compareCodes(a, b, prefix)),
  }));
}

/** Step 7: available section codes across every relevant sheet, grouped and sorted for the picker UI. */
export function getAvailableSections(wb: XLSX.WorkBook): SectionGroup[] {
  const codeSet = new Set<string>();
  for (const sheetName of getRelevantSheets(wb)) {
    const rows = sheetToRows(wb, sheetName);
    for (const row of rows) {
      for (let c = 2; c < row.length; c++) {
        const text = (row[c] ?? "").toString().trim();
        if (!text) continue;
        const parsed = parseCellText(text);
        if (!parsed) continue;
        for (const code of parsed.sectionCodes) codeSet.add(code);
      }
    }
  }
  return groupSections([...codeSet]);
}

/** Step 8: extract this user's classes for a chosen section code, deduped and sorted. */
export function extractClassesForSection(wb: XLSX.WorkBook, sectionCode: string): ClassEntry[] {
  const entries: ClassEntry[] = [];
  const seen = new Set<string>();
  for (const sheetName of getRelevantSheets(wb)) {
    const rows = sheetToRows(wb, sheetName);
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex < 0) continue;
    const ranges = parsePeriodRanges(rows, headerRowIndex);
    for (const cand of walkCandidates(rows, headerRowIndex, ranges)) {
      const parsed = parseCellText(cand.text);
      if (!parsed || !parsed.sectionCodes.includes(sectionCode)) continue;
      const key = `${cand.day}|${cand.room}|${parsed.courseName}|${cand.startTime}|${cand.endTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        id: crypto.randomUUID(),
        courseName: parsed.courseName,
        instructor: parsed.instructor,
        roomNumber: cand.room,
        dayOfWeek: cand.day,
        startTime: cand.startTime,
        endTime: cand.endTime,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return sortedByDayThenTime(entries);
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}
