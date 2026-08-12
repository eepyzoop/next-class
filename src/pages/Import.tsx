import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAppData } from "../context/AppDataContext";
import { getAvailableSections, extractClassesForSection, readWorkbook, type SectionGroup } from "../lib/parseTimetable";

type Step =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "parsing" }
  | { phase: "picking"; groups: SectionGroup[] }
  | { phase: "extracting"; groups: SectionGroup[]; selected: string }
  | { phase: "done"; added: number }
  | { phase: "error"; message: string };

export default function Import() {
  const { addClasses } = useAppData();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ phase: "idle" });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const wbRef = useRef<XLSX.WorkBook | null>(null);

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
      setStep({ phase: "picking", groups });
    } catch {
      setStep({ phase: "error", message: "Couldn't read that file. Make sure it's a valid .xlsx timetable." });
    }
  }

  async function handleContinue() {
    const wb = wbRef.current;
    if (!wb || !selectedCode || step.phase !== "picking") return;
    setStep({ phase: "extracting", groups: step.groups, selected: selectedCode });
    await new Promise((r) => setTimeout(r, 0));
    const classes = extractClassesForSection(wb, selectedCode);
    const added = await addClasses(classes);
    setStep({ phase: "done", added });
  }

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
            Found {step.groups.reduce((n, g) => n + g.codes.length, 0)} sections. Pick yours:
          </p>
          {step.groups.map((g) => (
            <div key={g.prefix} style={{ marginBottom: 12 }}>
              <p className="muted" style={{ margin: "0 0 6px" }}>{g.prefix}</p>
              {g.codes.map((code) => (
                <label key={code} className="list-row" style={{ cursor: "pointer" }}>
                  <span>{code}</span>
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
          <button className="btn-primary" disabled={!selectedCode} onClick={handleContinue}>
            <span>Continue</span>
            <span className="chevron">›</span>
          </button>
        </div>
      )}

      {step.phase === "extracting" && (
        <div className="panel">
          <p style={{ margin: 0 }}>Extracting your classes…</p>
        </div>
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
