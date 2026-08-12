export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Sunday ... 7 = Saturday (matches JS getDay()+1)

export interface ClassEntry {
  id: string;
  courseName: string;
  instructor?: string;
  roomNumber: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm", 24h
  endTime: string; // "HH:mm"
  createdAt: string; // ISO date
}

export interface TimetableProfile {
  id: string;
  name: string;
  classes: ClassEntry[];
  createdAt: string;
  updatedAt: string;
  importedFileName?: string;
}

export type ToDoType = "quiz" | "assignment" | "homework";

export interface ToDoItem {
  id: string;
  courseName: string;
  type: ToDoType;
  dueDate: string; // ISO datetime
  createdAt: string;
}

export interface NotificationSettings {
  classRemindersEnabled: boolean;
  classReminderLeadMinutes: number;
  taskRemindersEnabled: boolean;
}
