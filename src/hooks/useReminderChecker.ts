import { useEffect, useRef } from "react";
import { differenceInMinutes, isSameDay } from "date-fns";
import { useAppData } from "../context/AppDataContext";
import { showNotification } from "../lib/notifications";
import type { DayOfWeek } from "../types";

const CHECK_INTERVAL_MS = 60_000;
// ponytail: no per-task lead-time setting in the spec's NotificationSettings — one fixed
// "due soon" window for tasks, add a configurable lead if that's ever requested.
const TASK_DUE_SOON_MINUTES = 15;

function minutesUntilClassStart(startTime: string, dayOfWeek: DayOfWeek, now: Date): number | null {
  const today = (now.getDay() + 1) as DayOfWeek;
  if (dayOfWeek !== today) return null;
  const [h, m] = startTime.split(":").map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  return differenceInMinutes(start, now);
}

/** Runs the baseline in-app reminder check: on mount, on foreground, and on an interval while open. */
export function useReminderChecker(): void {
  const { timetable, todos, settings } = useAppData();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function check() {
      const now = new Date();

      if (settings.classRemindersEnabled) {
        for (const c of timetable.classes) {
          const minutesUntil = minutesUntilClassStart(c.startTime, c.dayOfWeek, now);
          if (minutesUntil === null || minutesUntil < 0 || minutesUntil > settings.classReminderLeadMinutes) continue;
          const key = `class:${c.id}:${now.toDateString()}`;
          if (notifiedRef.current.has(key)) continue;
          notifiedRef.current.add(key);
          showNotification("Class Reminder", `${c.courseName} starts in ${minutesUntil} min · ${c.roomNumber}`);
        }
      }

      if (settings.taskRemindersEnabled) {
        for (const t of todos) {
          const due = new Date(t.dueDate);
          const minutesUntil = differenceInMinutes(due, now);
          if (minutesUntil < 0 || minutesUntil > TASK_DUE_SOON_MINUTES || !isSameDay(due, now)) continue;
          const key = `todo:${t.id}`;
          if (notifiedRef.current.has(key)) continue;
          notifiedRef.current.add(key);
          const typeLabel = t.type[0].toUpperCase() + t.type.slice(1);
          showNotification(`${typeLabel} Due`, t.courseName);
        }
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timetable.classes, todos, settings]);
}
