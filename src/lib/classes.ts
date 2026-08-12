import type { ClassEntry, TimetableProfile } from "../types";

function dedupKey(c: Pick<ClassEntry, "dayOfWeek" | "roomNumber" | "courseName" | "startTime" | "endTime">) {
  return `${c.dayOfWeek}|${c.roomNumber}|${c.courseName}|${c.startTime}|${c.endTime}`;
}

/** Adds classes to a timetable, silently skipping duplicates. Returns the updated timetable and how many were added. */
export function addClasses(
  timetable: TimetableProfile,
  newClasses: ClassEntry[]
): { timetable: TimetableProfile; added: number } {
  const seen = new Set(timetable.classes.map(dedupKey));
  const toAdd: ClassEntry[] = [];
  for (const c of newClasses) {
    const key = dedupKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    toAdd.push(c);
  }
  return {
    timetable: { ...timetable, classes: [...timetable.classes, ...toAdd] },
    added: toAdd.length,
  };
}

export function deleteClass(timetable: TimetableProfile, classId: string): TimetableProfile {
  return { ...timetable, classes: timetable.classes.filter((c) => c.id !== classId) };
}

export function deleteCourse(timetable: TimetableProfile, courseName: string): TimetableProfile {
  return { ...timetable, classes: timetable.classes.filter((c) => c.courseName !== courseName) };
}

export function sortedByDayThenTime(classes: ClassEntry[]): ClassEntry[] {
  return [...classes].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}
