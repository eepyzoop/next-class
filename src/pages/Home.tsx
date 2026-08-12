import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { getClassStatus } from "../lib/schedule";
import { useTheme } from "../context/ThemeContext";

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default function Home() {
  const { timetable, loading } = useAppData();
  const { theme } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="screen">Loading…</div>;

  const status = getClassStatus(timetable.classes, now);

  return (
    <div className="screen">
      <h1 className={theme.titleShadow ? "shadowed" : ""}>NextClass</h1>

      {status.kind === "none" && (
        <div className="panel">
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>No classes today</p>
          <p className="muted" style={{ margin: "4px 0 0" }}>Enjoy the free time.</p>
        </div>
      )}

      {status.kind === "current" && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Happening now</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{status.cls.courseName}</p>
          <p className="muted" style={{ margin: "2px 0 12px" }}>
            {status.cls.roomNumber}
            {status.cls.instructor ? ` · ${status.cls.instructor}` : ""}
          </p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>{formatMinutes(status.minutesRemaining)} remaining</p>
        </div>
      )}

      {status.kind === "next" && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Up next</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{status.cls.courseName}</p>
          <p className="muted" style={{ margin: "2px 0 12px" }}>
            {status.cls.roomNumber}
            {status.cls.instructor ? ` · ${status.cls.instructor}` : ""}
          </p>
          <p style={{ margin: 0, fontSize: 16 }}>Starts in {formatMinutes(status.minutesUntil)}</p>
        </div>
      )}

      <Link to="/todo" className="btn-primary">
        <span className="icon">✓</span>
        Not To Do List
        <span className="chevron">›</span>
      </Link>
      <div style={{ height: 10 }} />
      <Link to="/settings" className="btn-primary">
        <span className="icon">⚙</span>
        Settings
        <span className="chevron">›</span>
      </Link>
    </div>
  );
}
