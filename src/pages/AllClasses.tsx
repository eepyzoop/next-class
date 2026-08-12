import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { sortedByDayThenTime } from "../lib/classes";
import type { ClassEntry, DayOfWeek } from "../types";

const DAY_NAMES: Record<DayOfWeek, string> = {
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
  7: "Saturday",
};

export default function AllClasses() {
  const { timetable, deleteClass, deleteCourse, loading } = useAppData();

  if (loading) return <div className="screen">Loading…</div>;

  const classes = sortedByDayThenTime(timetable.classes);
  const byDay = new Map<DayOfWeek, ClassEntry[]>();
  for (const c of classes) {
    if (!byDay.has(c.dayOfWeek)) byDay.set(c.dayOfWeek, []);
    byDay.get(c.dayOfWeek)!.push(c);
  }

  return (
    <div className="screen">
      <h1>All Classes</h1>

      {classes.length === 0 && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>No classes yet.</p>
        </div>
      )}

      {[...byDay.entries()].map(([day, dayClasses]) => (
        <div className="panel" key={day}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{DAY_NAMES[day]}</p>
          {dayClasses.map((c) => (
            <div className="list-row" key={c.id}>
              <div>
                <div>{c.courseName}</div>
                <div className="muted">
                  {c.startTime}–{c.endTime} · {c.roomNumber}
                  {c.instructor ? ` · ${c.instructor}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => deleteClass(c.id)} title="Delete this class" aria-label="Delete this class">
                  ✕
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete all sessions of "${c.courseName}"?`)) deleteCourse(c.courseName);
                  }}
                  title="Delete entire course"
                  aria-label="Delete entire course"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <Link to="/import" className="btn-primary">
        <span className="icon">＋</span>
        Import Timetable
        <span className="chevron">›</span>
      </Link>
    </div>
  );
}
