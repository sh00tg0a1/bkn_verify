import { create } from 'zustand';
import { 
  getAllFiles, 
  getOpenFile, 
  setOpenFile as saveOpenFile,
  getAllProjects,
  getCurrentProject,
  setCurrentProject as saveCurrentProject,
  getStoredData
} from './storage';
import { parseBKNFile, parseBKNNetwork } from './bkn-parser';
import type { BKNNetwork, BKNFile, Project } from '@/types/bkn';

interface BKNStore {
  network: BKNNetwork | null;
  openFile: string | null;
  projects: Project[];
  currentProjectId: string | null;
  refreshNetwork: () => void;
  setOpenFile: (path: string | null) => void;
  refreshFiles: () => void;
  setCurrentProject: (projectId: string) => void;
  refreshProjects: () => void;
}

export const useBKNStore = create<BKNStore>((set) => ({
  network: null,
  openFile: getOpenFile(),
  projects: [],
  currentProjectId: null,
  
  refreshNetwork: () => {
    const files = getAllFiles();
    const bknFiles: BKNFile[] = Object.entries(files).map(([path, content]) =>
      parseBKNFile(content, path)
    );
    const network = parseBKNNetwork(bknFiles);
    set({ network });
  },
  
  setOpenFile: (path: string | null) => {
    saveOpenFile(path);
    set({ openFile: path });
  },
  
  refreshFiles: () => {
    const files = getAllFiles();
    const bknFiles: BKNFile[] = Object.entries(files).map(([path, content]) =>
      parseBKNFile(content, path)
    );
    const network = parseBKNNetwork(bknFiles);
    const data = getStoredData();
    set({ 
      network, 
      openFile: getOpenFile(),
      projects: getAllProjects(),
      currentProjectId: data.currentProject,
    });
  },
  
  setCurrentProject: (projectId: string) => {
    saveCurrentProject(projectId);
    const files = getAllFiles();
    const bknFiles: BKNFile[] = Object.entries(files).map(([path, content]) =>
      parseBKNFile(content, path)
    );
    const network = parseBKNNetwork(bknFiles);
    set({ 
      currentProjectId: projectId, 
      openFile: null,
      network,
    });
  },
  
  refreshProjects: () => {
    const data = getStoredData();
    set({
      projects: getAllProjects(),
      currentProjectId: data.currentProject,
    });
  },
}));
