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

/** One parsed course cell: a specific day/time/room offering, and every section it's shared across. */
export interface CourseOffering {
  courseName: string;
  instructor?: string;
  sectionCodes: string[];
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  roomNumber: string;
}

/** Every parsed course cell across the relevant sheet(s) — the raw material for section pickers and extraction. */
export function getCourseCatalog(wb: XLSX.WorkBook): CourseOffering[] {
  const offerings: CourseOffering[] = [];
  for (const sheetName of getRelevantSheets(wb)) {
    const rows = sheetToRows(wb, sheetName);
    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex < 0) continue;
    const ranges = parsePeriodRanges(rows, headerRowIndex);
    for (const cand of walkCandidates(rows, headerRowIndex, ranges)) {
      const parsed = parseCellText(cand.text);
      if (!parsed || parsed.sectionCodes.length === 0) continue;
      offerings.push({
        courseName: parsed.courseName,
        instructor: parsed.instructor,
        sectionCodes: parsed.sectionCodes,
        dayOfWeek: cand.day,
        startTime: cand.startTime,
        endTime: cand.endTime,
        roomNumber: cand.room,
      });
    }
  }
  return offerings;
}

function offeringsToClasses(offerings: CourseOffering[]): ClassEntry[] {
  const seen = new Set<string>();
  const entries: ClassEntry[] = [];
  for (const o of offerings) {
    const key = `${o.dayOfWeek}|${o.roomNumber}|${o.courseName}|${o.startTime}|${o.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      id: crypto.randomUUID(),
      courseName: o.courseName,
      instructor: o.instructor,
      roomNumber: o.roomNumber,
      dayOfWeek: o.dayOfWeek,
      startTime: o.startTime,
      endTime: o.endTime,
      createdAt: new Date().toISOString(),
    });
  }
  return sortedByDayThenTime(entries);
}

/** Step 7: available section codes across every relevant sheet, grouped and sorted for the picker UI. */
export function getAvailableSections(wb: XLSX.WorkBook): SectionGroup[] {
  const codeSet = new Set<string>();
  for (const o of getCourseCatalog(wb)) {
    for (const code of o.sectionCodes) codeSet.add(code);
  }
  return groupSections([...codeSet]);
}

/** Step 8: extract this user's classes for a chosen section code, deduped and sorted. */
export function extractClassesForSection(wb: XLSX.WorkBook, sectionCode: string): ClassEntry[] {
  return offeringsToClasses(getCourseCatalog(wb).filter((o) => o.sectionCodes.includes(sectionCode)));
}

/** Every distinct course name offered to a given section — the default review set after picking a primary section. */
export function getCoursesForSection(catalog: CourseOffering[], sectionCode: string): string[] {
  return [...new Set(catalog.filter((o) => o.sectionCodes.includes(sectionCode)).map((o) => o.courseName))].sort();
}

/** Every section code that offers a given course name, grouped/sorted like the main picker (for a per-course override). */
export function getSectionsForCourse(catalog: CourseOffering[], courseName: string): SectionGroup[] {
  const codes = new Set<string>();
  for (const o of catalog) {
    if (o.courseName !== courseName) continue;
    for (const c of o.sectionCodes) codes.add(c);
  }
  return groupSections([...codes]);
}

/** Every distinct course name in the catalog, for the "add a course" search. */
export function getAllCourseNames(catalog: CourseOffering[]): string[] {
  return [...new Set(catalog.map((o) => o.courseName))].sort();
}

/**
 * Build the final class list from one section choice per course (e.g. a student's primary
 * section for most courses, but a different section for a repeater). Courses with no chosen
 * section are omitted.
 */
export function extractClassesForCourseSections(
  catalog: CourseOffering[],
  choices: ReadonlyMap<string, string>
): ClassEntry[] {
  const offerings = catalog.filter((o) => choices.get(o.courseName) === undefined ? false : o.sectionCodes.includes(choices.get(o.courseName)!));
  return offeringsToClasses(offerings);
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}
