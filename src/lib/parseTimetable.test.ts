import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  getAvailableSections,
  extractClassesForSection,
  getRelevantSheets,
  getCourseCatalog,
  getCoursesForSection,
  getSectionsForCourse,
  extractClassesForCourseSections,
} from "./parseTimetable";

function buildWorkbook(): XLSX.WorkBook {
  const aoa: (string | undefined)[][] = [
    ["", "", "9:00 - 9:50", "10:00 - 10:50"],
    ["Days", "Room"],
    ["Mon", "101", "Data Structures (CS-2A/2B): Dr. Khan", ""],
    ["", "102", "", "Circuits (EE-1B)"],
    ["Tue", "101", "Data Structures (CS-2A/2B): Dr. Khan", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Combined TT");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ignored"]]), "Notes");
  return wb;
}

describe("parseTimetable", () => {
  it("picks only the Combined TT sheet when present", () => {
    expect(getRelevantSheets(buildWorkbook())).toEqual(["Combined TT"]);
  });

  it("groups and sorts available section codes", () => {
    const groups = getAvailableSections(buildWorkbook());
    expect(groups).toEqual([
      { prefix: "CS-", codes: ["CS-2A", "CS-2B"] },
      { prefix: "EE-", codes: ["EE-1B"] },
    ]);
  });

  it("extracts classes for a section, expanding prefix-less codes and parsing instructor/time", () => {
    const classes = extractClassesForSection(buildWorkbook(), "CS-2A");
    expect(classes).toHaveLength(2);
    expect(classes[0]).toMatchObject({
      courseName: "Data Structures",
      instructor: "Dr. Khan",
      roomNumber: "101",
      dayOfWeek: 2, // Mon, sorted before Tue
      startTime: "09:00",
      endTime: "09:50",
    });
    expect(classes[1]).toMatchObject({
      courseName: "Data Structures",
      roomNumber: "101",
      dayOfWeek: 3, // Tue
      startTime: "09:00",
      endTime: "09:50",
    });
  });

  it("dedupes identical day|room|course|start|end candidates across sheets", () => {
    const classes = extractClassesForSection(buildWorkbook(), "CS-2A");
    const keys = classes.map((c) => `${c.dayOfWeek}|${c.roomNumber}|${c.courseName}|${c.startTime}|${c.endTime}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries a day label down across room-split rows until the next day label", () => {
    const classes = extractClassesForSection(buildWorkbook(), "EE-1B");
    expect(classes).toHaveLength(1);
    expect(classes[0]).toMatchObject({ dayOfWeek: 2, roomNumber: "102", startTime: "10:00" }); // still Monday
  });

  it("excludes a title-row cell above the header row from the section list", () => {
    const aoa: (string | undefined)[][] = [
      ["Fall Timetable (V1.0)", "", "", ""],
      ["", "", "9:00 - 9:50"],
      ["Days", "Room"],
      ["Mon", "101", "Data Structures (CS-2A)"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Combined TT");
    const groups = getAvailableSections(wb);
    expect(groups).toEqual([{ prefix: "CS-", codes: ["CS-2A"] }]);
  });
});

describe("course catalog (per-course section selection)", () => {
  function buildRepeaterWorkbook(): XLSX.WorkBook {
    const aoa: (string | undefined)[][] = [
      ["", "", "9:00 - 9:50", "10:00 - 10:50"],
      ["Days", "Room"],
      // PF is jointly scheduled for 1A and 2A (2A students here are repeaters)
      ["Mon", "101", "PF (CS-1A/2A): Mr. X", "Data Structures (CS-2A): Dr. Khan"],
      // PF also runs as its own normal section for 1B, at a different time/room
      ["Tue", "102", "", "PF (CS-1B): Mr. X"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Combined TT");
    return wb;
  }

  it("lists every course offered to a section, including shared/repeater ones", () => {
    const catalog = getCourseCatalog(buildRepeaterWorkbook());
    expect(getCoursesForSection(catalog, "CS-2A")).toEqual(["Data Structures", "PF"]);
  });

  it("lists every section that offers a given course", () => {
    const catalog = getCourseCatalog(buildRepeaterWorkbook());
    expect(getSectionsForCourse(catalog, "PF")).toEqual([{ prefix: "CS-", codes: ["CS-1A", "CS-1B", "CS-2A"] }]);
  });

  it("builds the final list from one section choice per course, letting a course be dropped or overridden", () => {
    const catalog = getCourseCatalog(buildRepeaterWorkbook());
    // A 2A student who already passed PF: keep Data Structures, drop PF entirely.
    const dropped = extractClassesForCourseSections(catalog, new Map([["Data Structures", "CS-2A"]]));
    expect(dropped.map((c) => c.courseName)).toEqual(["Data Structures"]);

    // A 2A student repeating PF, but via the 1B time slot instead of the jointly-scheduled 1A/2A one.
    const overridden = extractClassesForCourseSections(
      catalog,
      new Map([
        ["Data Structures", "CS-2A"],
        ["PF", "CS-1B"],
      ])
    );
    expect(overridden).toHaveLength(2);
    const pf = overridden.find((c) => c.courseName === "PF")!;
    expect(pf).toMatchObject({ dayOfWeek: 3, roomNumber: "102", startTime: "10:00" }); // Tue slot, not the Mon 1A/2A one
  });
});
