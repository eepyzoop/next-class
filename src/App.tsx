import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import AllClasses from "./pages/AllClasses";
import ToDo from "./pages/ToDo";
import ToDoEditor from "./pages/ToDoEditor";
import Settings from "./pages/Settings";
import ThemePicker from "./pages/ThemePicker";
import { useReminderChecker } from "./hooks/useReminderChecker";
import { BANNER_EVENT, type BannerDetail } from "./lib/notifications";

// xlsx is a large dependency only needed on this screen — split it into its own chunk.
const Import = lazy(() => import("./pages/Import"));

function Banner() {
  const [banner, setBanner] = useState<BannerDetail | null>(null);

  useEffect(() => {
    function onBanner(e: Event) {
      setBanner((e as CustomEvent<BannerDetail>).detail);
      setTimeout(() => setBanner(null), 5000);
    }
    window.addEventListener(BANNER_EVENT, onBanner);
    return () => window.removeEventListener(BANNER_EVENT, onBanner);
  }, []);

  if (!banner) return null;
  return (
    <div
      className="panel"
      style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 100, maxWidth: 480, margin: "0 auto" }}
    >
      <strong>{banner.title}</strong>
      <div className="muted">{banner.body}</div>
    </div>
  );
}

export default function App() {
  useReminderChecker();

  return (
    <>
      <Banner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/classes" element={<AllClasses />} />
        <Route
          path="/import"
          element={
            <Suspense fallback={<div className="screen">Loading…</div>}>
              <Import />
            </Suspense>
          }
        />
        <Route path="/todo" element={<ToDo />} />
        <Route path="/todo/new" element={<ToDoEditor />} />
        <Route path="/todo/:id/edit" element={<ToDoEditor />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/theme" element={<ThemePicker />} />
      </Routes>
      <nav className="tabbar">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">🏠</span>
          Home
        </NavLink>
        <NavLink to="/classes" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">📅</span>
          Classes
        </NavLink>
        <NavLink to="/todo" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">✓</span>
          To-Do
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">⚙</span>
          Settings
        </NavLink>
      </nav>
    </>
  );
}
