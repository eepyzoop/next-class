export interface Theme {
  id: string;
  name: string;
  /** CSS gradient used as the full-bleed background */
  background: string;
  panelColor: string; // semi-transparent panel background
  accentColor: string; // semi-transparent button/accent background
  blur: string; // backdrop-filter blur amount, e.g. "20px"
  titleShadow: boolean; // drop shadow on large titles for legibility
}

export const themes: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    background: "radial-gradient(circle at 20% 20%, #1e2a4a 0%, #0a0e1a 60%)",
    panelColor: "rgba(255,255,255,0.08)",
    accentColor: "rgba(90,120,255,0.35)",
    blur: "24px",
    titleShadow: true,
  },
  {
    id: "plum",
    name: "Plum",
    background: "radial-gradient(circle at 80% 10%, #3a1f4d 0%, #120a17 60%)",
    panelColor: "rgba(255,255,255,0.07)",
    accentColor: "rgba(200,110,255,0.3)",
    blur: "22px",
    titleShadow: true,
  },
  {
    id: "forest",
    name: "Forest",
    background: "radial-gradient(circle at 15% 85%, #123324 0%, #05100a 60%)",
    panelColor: "rgba(255,255,255,0.07)",
    accentColor: "rgba(90,220,150,0.3)",
    blur: "22px",
    titleShadow: true,
  },
  {
    id: "graphite",
    name: "Graphite",
    background: "linear-gradient(160deg, #2a2a2e 0%, #0c0c0e 70%)",
    panelColor: "rgba(255,255,255,0.06)",
    accentColor: "rgba(255,255,255,0.18)",
    blur: "18px",
    titleShadow: false,
  },
  {
    id: "ember",
    name: "Ember",
    background: "radial-gradient(circle at 75% 90%, #4a1f16 0%, #170907 60%)",
    panelColor: "rgba(255,255,255,0.07)",
    accentColor: "rgba(255,140,90,0.3)",
    blur: "22px",
    titleShadow: true,
  },
];

export const defaultThemeId = themes[0].id;

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}
