import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDays, format, startOfWeek } from "date-fns";
import { useAppData } from "../context/AppDataContext";
import type { ToDoType } from "../types";

const TYPES: { value: ToDoType; label: string }[] = [
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "homework", label: "Homework" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ToDoEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { timetable, todos, addToDo, updateToDo } = useAppData();
  const existing = id ? todos.find((t) => t.id === id) : undefined;

  const courseOptions = useMemo(
    () => [...new Set(timetable.classes.map((c) => c.courseName))].sort(),
    [timetable.classes]
  );

  const [courseName, setCourseName] = useState(existing?.courseName ?? courseOptions[0] ?? "");
  const [customCourse, setCustomCourse] = useState(courseOptions.length === 0);
  const [type, setType] = useState<ToDoType>(existing?.type ?? "homework");
  const [dueDate, setDueDate] = useState(
    existing ? toDatetimeLocal(existing.dueDate) : toDatetimeLocal(new Date().toISOString())
  );

  const weekStart = startOfWeek(new Date());

  function pickWeekday(offset: number) {
    const day = addDays(weekStart, offset);
    const [, time] = dueDate.split("T");
    setDueDate(`${format(day, "yyyy-MM-dd")}T${time ?? "23:59"}`);
  }

  function handleSave() {
    if (!courseName.trim()) return;
    const iso = new Date(dueDate).toISOString();
    if (existing) {
      updateToDo({ ...existing, courseName: courseName.trim(), type, dueDate: iso });
    } else {
      addToDo({
        id: crypto.randomUUID(),
        courseName: courseName.trim(),
        type,
        dueDate: iso,
        createdAt: new Date().toISOString(),
      });
    }
    navigate("/todo");
  }

  return (
    <div className="screen">
      <h1>{existing ? "Edit To-Do" : "Add To-Do"}</h1>

      <div className="panel">
        <p className="muted" style={{ margin: "0 0 6px" }}>Course</p>
        {!customCourse && courseOptions.length > 0 ? (
          <select
            value={courseName}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setCustomCourse(true);
                setCourseName("");
              } else {
                setCourseName(e.target.value);
              }
            }}
          >
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other__">Other…</option>
          </select>
        ) : (
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Course name" />
        )}
      </div>

      <div className="panel">
        <p className="muted" style={{ margin: "0 0 6px" }}>Type</p>
        <div style={{ display: "flex", gap: 8 }}>
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: type === t.value ? "var(--accent-color)" : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <p className="muted" style={{ margin: "0 0 6px" }}>Due</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => pickWeekday(i)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <button className="btn-primary" onClick={handleSave}>
        <span>Save</span>
      </button>
    </div>
  );
}
