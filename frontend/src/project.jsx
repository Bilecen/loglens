import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const ProjectCtx = createContext(null);
const STORE_KEY = "loglens_project";

// Girişten SONRA mount edilir (Shell içinde). Seçili proje localStorage'da tutulur.
export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectIdState] = useState(() => Number(localStorage.getItem(STORE_KEY)) || null);
  const [loading, setLoading] = useState(true);

  const setProjectId = useCallback((id) => {
    setProjectIdState(id);
    localStorage.setItem(STORE_KEY, String(id));
  }, []);

  const reload = useCallback(async () => {
    const list = await api.projects();
    setProjects(list);
    // Seçili proje yoksa ya da silinmişse ilk projeye düş
    setProjectIdState((cur) => {
      const valid = list.some((p) => p.id === cur);
      const next = valid ? cur : (list[0]?.id ?? null);
      if (next) localStorage.setItem(STORE_KEY, String(next));
      return next;
    });
    return list;
  }, []);

  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const project = projects.find((p) => p.id === projectId) || null;

  return (
    <ProjectCtx.Provider value={{ projects, project, projectId, setProjectId, reload, loading }}>
      {children}
    </ProjectCtx.Provider>
  );
}

export const useProject = () => useContext(ProjectCtx);
