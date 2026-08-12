import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAppData } from "../context/AppDataContext";
import type { ToDoType } from "../types";

const TYPE_LABEL: Record<ToDoType, string> = {
  quiz: "Quiz",
  assignment: "Assignment",
  homework: "Homework",
};

export default function ToDo() {
  const { todos, deleteToDo, loading } = useAppData();

  if (loading) return <div className="screen">Loading…</div>;

  const sorted = [...todos].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="screen">
      <h1>Not To Do</h1>

      {sorted.length === 0 && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Nothing due. Add something below.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="panel">
          {sorted.map((t) => (
            <div className="list-row" key={t.id}>
              <Link to={`/todo/${t.id}/edit`} style={{ textDecoration: "none", color: "inherit" }}>
                <div>{t.courseName}</div>
                <div className="muted">
                  {TYPE_LABEL[t.type]} · {format(new Date(t.dueDate), "EEE, MMM d · h:mm a")}
                </div>
              </Link>
              <button onClick={() => deleteToDo(t.id)} aria-label="Delete">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <Link to="/todo/new" className="btn-primary">
        <span className="icon">＋</span>
        Add To-Do
        <span className="chevron">›</span>
      </Link>
    </div>
  );
}
