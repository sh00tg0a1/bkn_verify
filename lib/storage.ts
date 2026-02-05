import type { StoredData, Project } from '@/types/bkn';

const STORAGE_KEY = 'bkn_editor_data_v2';

export function getStoredData(): StoredData {
  if (typeof window === 'undefined') {
    return { projects: {}, currentProject: null, openFile: null, treeState: {} };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load stored data:', e);
  }

  return { projects: {}, currentProject: null, openFile: null, treeState: {} };
}

export function saveStoredData(data: StoredData): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export function getCurrentProject(): Project | null {
  const data = getStoredData();
  if (!data.currentProject) return null;
  return data.projects[data.currentProject] || null;
}

export function setCurrentProject(projectId: string): void {
  const data = getStoredData();
  if (data.projects[projectId]) {
    data.currentProject = projectId;
    data.openFile = null; // Reset open file when switching projects
    data.treeState = {}; // Reset tree state
    saveStoredData(data);
  }
}

export function getAllProjects(): Project[] {
  const data = getStoredData();
  return Object.values(data.projects);
}

export function getFile(path: string): string | null {
  const project = getCurrentProject();
  if (!project) return null;
  return project.files[path] || null;
}

export function saveFile(path: string, content: string): void {
  const data = getStoredData();
  if (!data.currentProject || !data.projects[data.currentProject]) return;
  data.projects[data.currentProject].files[path] = content;
  saveStoredData(data);
}

export function deleteFile(path: string): void {
  const data = getStoredData();
  if (!data.currentProject || !data.projects[data.currentProject]) return;
  delete data.projects[data.currentProject].files[path];
  if (data.openFile === path) {
    data.openFile = null;
  }
  saveStoredData(data);
}

export function renameFile(oldPath: string, newPath: string): void {
  const data = getStoredData();
  if (!data.currentProject || !data.projects[data.currentProject]) return;
  const project = data.projects[data.currentProject];
  if (project.files[oldPath]) {
    project.files[newPath] = project.files[oldPath];
    delete project.files[oldPath];
    if (data.openFile === oldPath) {
      data.openFile = newPath;
    }
    saveStoredData(data);
  }
}

export function getAllFiles(): Record<string, string> {
  const project = getCurrentProject();
  return project?.files || {};
}

export function getOpenFile(): string | null {
  return getStoredData().openFile;
}

export function setOpenFile(path: string | null): void {
  const data = getStoredData();
  data.openFile = path;
  saveStoredData(data);
}

export function getTreeState(): Record<string, boolean> {
  return getStoredData().treeState || {};
}

export function setTreeState(state: Record<string, boolean>): void {
  const data = getStoredData();
  data.treeState = state;
  saveStoredData(data);
}

export function updateTreeState(path: string, expanded: boolean): void {
  const data = getStoredData();
  if (!data.treeState) {
    data.treeState = {};
  }
  data.treeState[path] = expanded;
  saveStoredData(data);
}

export function resetStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Initialize storage with example projects if empty
 */
export async function initializeStorage(): Promise<void> {
  const data = getStoredData();
  if (Object.keys(data.projects).length === 0) {
    // Load examples via API
    try {
      const response = await fetch('/api/examples');
      if (response.ok) {
        const result = await response.json();
        const projects: Record<string, Project> = {};
        
        for (const proj of result.projects || []) {
          projects[proj.id] = proj;
        }
        
        const newData: StoredData = {
          projects,
          currentProject: result.projects?.[0]?.id || null,
          openFile: null,
          treeState: {},
        };
        saveStoredData(newData);
      }
    } catch (e) {
      console.error('Failed to load examples:', e);
    }
  }
}
