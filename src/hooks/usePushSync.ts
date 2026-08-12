import { useEffect } from "react";
import { useAppData } from "../context/AppDataContext";
import { resyncPushSubscription } from "../lib/push";

/** Keeps the Web Push backend's copy of this device's schedule fresh whenever it changes. */
export function usePushSync(): void {
  const { loading, timetable, todos, settings } = useAppData();

  useEffect(() => {
    if (loading) return;
    resyncPushSubscription({ classes: timetable.classes, todos, settings });
  }, [loading, timetable.classes, todos, settings]);
}
