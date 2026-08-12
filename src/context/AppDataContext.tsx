import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { ClassEntry, NotificationSettings, TimetableProfile, ToDoItem } from "../types";
import * as db from "../db";
import { addClasses as addClassesToTimetable, deleteClass as removeClass, deleteCourse as removeCourse } from "../lib/classes";

interface AppDataContextValue {
  loading: boolean;
  timetable: TimetableProfile;
  todos: ToDoItem[];
  settings: NotificationSettings;
  addClasses: (classes: ClassEntry[]) => Promise<number>;
  deleteClass: (classId: string) => Promise<void>;
  deleteCourse: (courseName: string) => Promise<void>;
  clearTimetable: (importedFileName?: string) => Promise<void>;
  addToDo: (todo: ToDoItem) => Promise<void>;
  updateToDo: (todo: ToDoItem) => Promise<void>;
  deleteToDo: (id: string) => Promise<void>;
  updateSettings: (settings: NotificationSettings) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetableState] = useState<TimetableProfile>(db.defaultTimetable);
  const [todos, setTodosState] = useState<ToDoItem[]>([]);
  const [settings, setSettingsState] = useState<NotificationSettings>(db.defaultSettings);

  useEffect(() => {
    (async () => {
      const [t, td, s] = await Promise.all([db.getTimetable(), db.getToDos(), db.getSettings()]);
      setTimetableState(t);
      setTodosState(td);
      setSettingsState(s);
      setLoading(false);
    })();
  }, []);

  const addClasses = useCallback(
    async (classes: ClassEntry[]) => {
      const { timetable: updated, added } = addClassesToTimetable(timetable, classes);
      await db.setTimetable(updated);
      setTimetableState(updated);
      return added;
    },
    [timetable]
  );

  const deleteClass = useCallback(
    async (classId: string) => {
      const updated = removeClass(timetable, classId);
      await db.setTimetable(updated);
      setTimetableState(updated);
    },
    [timetable]
  );

  const deleteCourse = useCallback(
    async (courseName: string) => {
      const updated = removeCourse(timetable, courseName);
      await db.setTimetable(updated);
      setTimetableState(updated);
    },
    [timetable]
  );

  const clearTimetable = useCallback(async (importedFileName?: string) => {
    const fresh = { ...db.defaultTimetable(), importedFileName };
    await db.setTimetable(fresh);
    setTimetableState(fresh);
  }, []);

  const addToDo = useCallback(
    async (todo: ToDoItem) => {
      const updated = [...todos, todo];
      await db.setToDos(updated);
      setTodosState(updated);
    },
    [todos]
  );

  const updateToDo = useCallback(
    async (todo: ToDoItem) => {
      const updated = todos.map((t) => (t.id === todo.id ? todo : t));
      await db.setToDos(updated);
      setTodosState(updated);
    },
    [todos]
  );

  const deleteToDo = useCallback(
    async (id: string) => {
      const updated = todos.filter((t) => t.id !== id);
      await db.setToDos(updated);
      setTodosState(updated);
    },
    [todos]
  );

  const updateSettings = useCallback(async (next: NotificationSettings) => {
    await db.setSettings(next);
    setSettingsState(next);
  }, []);

  return (
    <AppDataContext.Provider
      value={{
        loading,
        timetable,
        todos,
        settings,
        addClasses,
        deleteClass,
        deleteCourse,
        clearTimetable,
        addToDo,
        updateToDo,
        deleteToDo,
        updateSettings,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
