import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { getAvailableSections, extractClassesForSection, getRelevantSheets } from "./parseTimetable";

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
});
