import type { ClassEntry, DayOfWeek } from "../types";

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface CurrentClassStatus {
  kind: "current";
  cls: ClassEntry;
  progress: number; // 0..1
  minutesRemaining: number;
}

export interface NextClassStatus {
  kind: "next";
  cls: ClassEntry;
  minutesUntil: number;
}

export interface NoClassStatus {
  kind: "none";
}

export type ClassStatus = CurrentClassStatus | NextClassStatus | NoClassStatus;

/** What to show on Home: the class happening right now, else the next one today, else none. */
export function getClassStatus(classes: ClassEntry[], now: Date = new Date()): ClassStatus {
  const day = (now.getDay() + 1) as DayOfWeek;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todaysClasses = classes
    .filter((c) => c.dayOfWeek === day)
    .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

  for (const cls of todaysClasses) {
    const start = minutesOfDay(cls.startTime);
    const end = minutesOfDay(cls.endTime);
    if (nowMinutes >= start && nowMinutes < end) {
      return {
        kind: "current",
        cls,
        progress: (nowMinutes - start) / (end - start),
        minutesRemaining: end - nowMinutes,
      };
    }
    if (nowMinutes < start) {
      return { kind: "next", cls, minutesUntil: start - nowMinutes };
    }
  }

  return { kind: "none" };
}
