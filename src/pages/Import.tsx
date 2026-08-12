import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAppData } from "../context/AppDataContext";
import {
  getAvailableSections,
  getCourseCatalog,
  getCoursesForSection,
  getSectionsForCourse,
  getAllCourseNames,
  extractClassesForCourseSections,
  readWorkbook,
  type SectionGroup,
  type CourseOffering,
} from "../lib/parseTimetable";

type Step =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "parsing" }
  | { phase: "picking"; groups: SectionGroup[] }
  | { phase: "reviewing"; primarySection: string }
  | { phase: "done"; added: number }
  | { phase: "error"; message: string };

function flattenGroups(groups: SectionGroup[]): string[] {
  return groups.flatMap((g) => g.codes);
}

/** Sub-groups a prefix's codes by the leading level digits (e.g. "BCS-3E" -> level "3"), so a
 * 74-code "BCS-" group renders as Level 1 / Level 3 / Level 5 instead of one flat list. */
function subGroupByLevel(group: SectionGroup): { level: string; codes: string[] }[] {
  if (group.prefix === "Other") return [{ level: "", codes: group.codes }];
  const byLevel = new Map<string, string[]>();
  for (const code of group.codes) {
    const rest = code.slice(group.prefix.length);
    const level = rest.match(/^\d+/)?.[0] ?? "Other";
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(code);
  }
  const levels = [...byLevel.keys()].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return levels.map((level) => ({ level, codes: byLevel.get(level)! }));
}

export default function Import() {
  const { addClasses } = useAppData();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ phase: "idle" });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const wbRef = useRef<XLSX.WorkBook | null>(null);
  const catalogRef = useRef<CourseOffering[]>([]);

  // Review-step state
  const [courseOrder, setCourseOrder] = useState<string[]>([]);
  const [choices, setChoices] = useState<Map<string, string>>(new Map());
  const [addQuery, setAddQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function handleFile(file: File) {
    try {
      setStep({ phase: "reading" });
      const wb = await readWorkbook(file);
      wbRef.current = wb;

      setStep({ phase: "parsing" });
      await new Promise((r) => setTimeout(r, 0)); // let the UI paint the progress text
      const groups = getAvailableSections(wb);
      if (groups.length === 0) {
        setStep({ phase: "error", message: "No sections found in this file. Check it's a combined timetable export." });
        return;
      }
      catalogRef.current = getCourseCatalog(wb);
      setStep({ phase: "picking", groups });
    } catch {
      setStep({ phase: "error", message: "Couldn't read that file. Make sure it's a valid .xlsx timetable." });
    }
  }

  function handleContinue() {
    if (!selectedCode) return;
    const defaultCourses = getCoursesForSection(catalogRef.current, selectedCode);
    setCourseOrder(defaultCourses);
    setChoices(new Map(defaultCourses.map((c) => [c, selectedCode])));
    setStep({ phase: "reviewing", primarySection: selectedCode });
  }

  function toggleCourse(courseName: string, primarySection: string) {
    setChoices((prev) => {
      const next = new Map(prev);
      if (next.has(courseName)) {
        next.delete(courseName);
      } else {
        const options = flattenGroups(getSectionsForCourse(catalogRef.current, courseName));
        next.set(courseName, options.includes(primarySection) ? primarySection : options[0]);
      }
      return next;
    });
  }

  function setCourseSection(courseName: string, sectionCode: string) {
    setChoices((prev) => new Map(prev).set(courseName, sectionCode));
  }

  function addCourse(courseName: string, primarySection: string) {
    const options = flattenGroups(getSectionsForCourse(catalogRef.current, courseName));
    setCourseOrder((prev) => (prev.includes(courseName) ? prev : [...prev, courseName]));
    setChoices((prev) => new Map(prev).set(courseName, options.includes(primarySection) ? primarySection : options[0]));
    setAddQuery("");
    setShowAdd(false);
  }

  async function handleSaveReview() {
    const classes = extractClassesForCourseSections(catalogRef.current, choices);
    const added = await addClasses(classes);
    setStep({ phase: "done", added });
  }

  const addableCourses = useMemo(() => {
    if (!showAdd) return [];
    const all = getAllCourseNames(catalogRef.current);
    const notAlreadyAdded = all.filter((c) => !courseOrder.includes(c));
    if (!addQuery.trim()) return notAlreadyAdded.slice(0, 30);
    const q = addQuery.trim().toLowerCase();
    return notAlreadyAdded.filter((c) => c.toLowerCase().includes(q)).slice(0, 30);
  }, [showAdd, addQuery, courseOrder]);

  return (
    <div className="screen">
      <h1>Import Timetable</h1>

      {step.phase === "idle" && (
        <div className="panel">
          <p className="muted" style={{ marginTop: 0 }}>
            Pick your school's combined timetable workbook (.xlsx).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {(step.phase === "reading" || step.phase === "parsing") && (
        <div className="panel">
          <p style={{ margin: 0 }}>{step.phase === "reading" ? "Reading file…" : "Parsing sheets…"}</p>
        </div>
      )}

      {step.phase === "picking" && (
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            Found {step.groups.reduce((n, g) => n + g.codes.length, 0)} sections. Pick your section:
          </p>
          {step.groups.map((g) => (
            <div key={g.prefix} style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{g.prefix}</p>
              {subGroupByLevel(g).map((sub) => (
                <div key={sub.level} style={{ marginBottom: 8 }}>
                  {sub.level && <p className="muted" style={{ margin: "0 0 4px" }}>Level {sub.level}</p>}
                  {sub.codes.map((code) => (
                    <label key={code} className="list-row" style={{ cursor: "pointer" }}>
                      <span style={{ whiteSpace: "nowrap" }}>{code}</span>
                      <input
                        type="radio"
                        name="section"
                        checked={selectedCode === code}
                        onChange={() => setSelectedCode(code)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button className="btn-primary" disabled={!selectedCode} onClick={handleContinue}>
            <span>Continue</span>
            <span className="chevron">›</span>
          </button>
        </div>
      )}

      {step.phase === "reviewing" && (
        <>
          <div className="panel">
            <p style={{ marginTop: 0 }}>
              Uncheck anything you're not taking — repeats or electives you didn't pick. Change the section next to
              a course if a repeat runs at a different time.
            </p>
            {courseOrder.map((courseName) => {
              const included = choices.has(courseName);
              const options = flattenGroups(getSectionsForCourse(catalogRef.current, courseName));
              return (
                <div className="list-row" key={courseName}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={included}
                      onChange={() => toggleCourse(courseName, step.primarySection)}
                    />
                    <span>{courseName}</span>
                  </label>
                  {included && options.length > 1 && (
                    <select
                      style={{ width: "auto" }}
                      value={choices.get(courseName)}
                      onChange={(e) => setCourseSection(courseName, e.target.value)}
                    >
                      {options.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <div className="panel">
            {!showAdd ? (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <span className="icon">＋</span>
                Add a Repeat / Extra Course
              </button>
            ) : (
              <div>
                <input
                  autoFocus
                  placeholder="Search courses…"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                {addableCourses.map((courseName) => (
                  <div className="list-row" key={courseName} style={{ cursor: "pointer" }}>
                    <span onClick={() => addCourse(courseName, step.primarySection)}>{courseName}</span>
                  </div>
                ))}
                {addableCourses.length === 0 && <p className="muted">No matching courses.</p>}
                <button
                  onClick={() => setShowAdd(false)}
                  style={{ marginTop: 8, background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={handleSaveReview}>
            <span className="icon">✓</span>
            Save Timetable
          </button>
        </>
      )}

      {step.phase === "done" && (
        <div className="panel">
          <p style={{ marginTop: 0 }}>Added {step.added} new class{step.added === 1 ? "" : "es"} to your timetable.</p>
          <button className="btn-primary" onClick={() => navigate("/classes")}>
            <span>View All Classes</span>
            <span className="chevron">›</span>
          </button>
        </div>
      )}

      {step.phase === "error" && (
        <div className="panel">
          <p style={{ marginTop: 0 }}>{step.message}</p>
          <button className="btn-primary" onClick={() => setStep({ phase: "idle" })}>
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
}
