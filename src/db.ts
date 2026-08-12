import { openDB, type DBSchema } from "idb";
import type { NotificationSettings, TimetableProfile, ToDoItem } from "./types";

const TIMETABLE_KEY = "nextclass_timetable";
const TODO_KEY = "nextclass_todo";
const SETTINGS_KEY = "nextclass_settings";

interface NextClassDB extends DBSchema {
  keyval: {
    key: string;
    value: TimetableProfile | ToDoItem[] | NotificationSettings;
  };
}

const dbPromise = openDB<NextClassDB>("nextclass", 1, {
  upgrade(db) {
    db.createObjectStore("keyval");
  },
});

export const defaultTimetable = (): TimetableProfile => ({
  id: crypto.randomUUID(),
  name: "My Timetable",
  classes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const defaultSettings = (): NotificationSettings => ({
  classRemindersEnabled: true,
  classReminderLeadMinutes: 15,
  taskRemindersEnabled: true,
});

export async function getTimetable(): Promise<TimetableProfile> {
  const db = await dbPromise;
  const value = (await db.get("keyval", TIMETABLE_KEY)) as TimetableProfile | undefined;
  return value ?? defaultTimetable();
}

export async function setTimetable(timetable: TimetableProfile): Promise<void> {
  const db = await dbPromise;
  await db.put("keyval", { ...timetable, updatedAt: new Date().toISOString() }, TIMETABLE_KEY);
}

export async function getToDos(): Promise<ToDoItem[]> {
  const db = await dbPromise;
  const value = (await db.get("keyval", TODO_KEY)) as ToDoItem[] | undefined;
  return value ?? [];
}

export async function setToDos(todos: ToDoItem[]): Promise<void> {
  const db = await dbPromise;
  await db.put("keyval", todos, TODO_KEY);
}

export async function getSettings(): Promise<NotificationSettings> {
  const db = await dbPromise;
  const value = (await db.get("keyval", SETTINGS_KEY)) as NotificationSettings | undefined;
  return value ?? defaultSettings();
}

export async function setSettings(settings: NotificationSettings): Promise<void> {
  const db = await dbPromise;
  await db.put("keyval", settings, SETTINGS_KEY);
}
