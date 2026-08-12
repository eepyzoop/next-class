import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useTheme } from "../context/ThemeContext";
import { APP_VERSION } from "../version";
import { ensureNotificationPermission, showNotification } from "../lib/notifications";

export default function Settings() {
  const { timetable, settings, updateSettings, clearTimetable } = useAppData();
  const { theme } = useTheme();

  async function handleExport() {
    const blob = new Blob([JSON.stringify(timetable, null, 2)], { type: "application/json" });
    const file = new File([blob], "nextclass-timetable.json", { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "NextClass Timetable" });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nextclass-timetable.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleClear() {
    if (confirm("Clear your entire timetable? This can't be undone.")) {
      await clearTimetable();
    }
  }

  async function handleTestNotification() {
    const granted = await ensureNotificationPermission();
    if (granted) {
      showNotification("Class Reminder", "Test notification · this is what reminders look like");
    } else {
      alert("Notifications are blocked. Enable them in your browser/OS settings to receive reminders.");
    }
  }

  async function handleToggleClassReminders(enabled: boolean) {
    if (enabled) await ensureNotificationPermission();
    updateSettings({ ...settings, classRemindersEnabled: enabled });
  }

  async function handleToggleTaskReminders(enabled: boolean) {
    if (enabled) await ensureNotificationPermission();
    updateSettings({ ...settings, taskRemindersEnabled: enabled });
  }

  return (
    <div className="screen">
      <h1 className={theme.titleShadow ? "shadowed" : ""}>Settings</h1>

      <Link to="/theme" className="btn-primary">
        <span className="icon">🎨</span>
        Theme: {theme.name}
        <span className="chevron">›</span>
      </Link>
      <div style={{ height: 10 }} />

      <div className="panel">
        <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Timetable</p>
        <p className="muted" style={{ margin: "0 0 12px" }}>{timetable.classes.length} classes loaded</p>
        <Link to="/import" className="btn-primary">
          <span className="icon">⇪</span>
          Load / Update Timetable
          <span className="chevron">›</span>
        </Link>
        <div style={{ height: 10 }} />
        <button className="btn-primary" onClick={handleExport}>
          <span className="icon">⇩</span>
          Export Timetable
        </button>
        <div style={{ height: 10 }} />
        <button className="btn-primary" onClick={handleClear}>
          <span className="icon">🗑</span>
          Clear Timetable
        </button>
      </div>

      <div className="panel">
        <p style={{ margin: "0 0 12px", fontWeight: 700 }}>Reminders</p>

        <div className="list-row">
          <span>Class Reminders</span>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={settings.classRemindersEnabled}
            onChange={(e) => handleToggleClassReminders(e.target.checked)}
          />
        </div>
        <div className="list-row">
          <span>Remind me before class</span>
          <select
            style={{ width: "auto" }}
            value={settings.classReminderLeadMinutes}
            onChange={(e) => updateSettings({ ...settings, classReminderLeadMinutes: Number(e.target.value) })}
          >
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </div>
        <div className="list-row">
          <span>Task Reminders</span>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={settings.taskRemindersEnabled}
            onChange={(e) => handleToggleTaskReminders(e.target.checked)}
          />
        </div>

        <div style={{ height: 4 }} />
        <button className="btn-primary" onClick={handleTestNotification}>
          <span className="icon">🔔</span>
          Send Test Notification
        </button>
      </div>

      <p className="muted" style={{ textAlign: "center" }}>NextClass v{APP_VERSION}</p>
    </div>
  );
}
