import { useTheme } from "../context/ThemeContext";

export default function ThemePicker() {
  const { themes, themeId, setThemeId } = useTheme();

  return (
    <div className="screen">
      <h1>Theme</h1>
      <div className="panel">
        {themes.map((t) => (
          <label key={t.id} className="list-row" style={{ cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  background: t.background,
                  display: "inline-block",
                }}
              />
              {t.name}
            </span>
            <input type="radio" name="theme" checked={themeId === t.id} onChange={() => setThemeId(t.id)} />
          </label>
        ))}
      </div>
    </div>
  );
}
