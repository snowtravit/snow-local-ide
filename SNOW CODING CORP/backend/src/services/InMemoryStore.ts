import { v4 as uuidv4 } from 'uuid';

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FileData {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionData {
  id: string;
  projectId: string;
  language: string;
  code: string;
  output: string;
  exitCode: number;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
  createdAt: string;
}

/**
 * In-memory store as fallback when PostgreSQL is not available.
 * Data persists only during the current server session.
 */
class InMemoryStore {
  private projects: Map<string, ProjectData> = new Map();
  private files: Map<string, FileData> = new Map();
  private executions: Map<string, ExecutionData> = new Map();

  // --- Projects ---

  createProject(data: { name: string; description?: string; languages?: string[] }): ProjectData {
    const now = new Date().toISOString();
    const project: ProjectData = {
      id: uuidv4(),
      name: data.name,
      description: data.description || '',
      languages: data.languages || [],
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    return project;
  }

  getAllProjects(): ProjectData[] {
    return Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getProject(id: string): ProjectData | undefined {
    return this.projects.get(id);
  }

  updateProject(id: string, data: Partial<ProjectData>): ProjectData | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...data, updatedAt: new Date().toISOString() };
    this.projects.set(id, updated);
    return updated;
  }

  deleteProject(id: string): boolean {
    // Delete associated files and executions
    for (const [fid, file] of this.files) {
      if (file.projectId === id) this.files.delete(fid);
    }
    for (const [eid, exec] of this.executions) {
      if (exec.projectId === id) this.executions.delete(eid);
    }
    return this.projects.delete(id);
  }

  // --- Files ---

  createFile(data: { projectId: string; name: string; path: string; content?: string; language: string }): FileData {
    const now = new Date().toISOString();
    const file: FileData = {
      id: uuidv4(),
      projectId: data.projectId,
      name: data.name,
      path: data.path,
      content: data.content || '',
      language: data.language,
      createdAt: now,
      updatedAt: now,
    };
    this.files.set(file.id, file);
    return file;
  }

  getFilesByProject(projectId: string): FileData[] {
    return Array.from(this.files.values()).filter((f) => f.projectId === projectId);
  }

  getFile(id: string): FileData | undefined {
    return this.files.get(id);
  }

  updateFile(id: string, data: Partial<FileData>): FileData | undefined {
    const file = this.files.get(id);
    if (!file) return undefined;
    const updated = { ...file, ...data, updatedAt: new Date().toISOString() };
    this.files.set(id, updated);
    return updated;
  }

  deleteFile(id: string): boolean {
    return this.files.delete(id);
  }

  // --- Executions ---

  createExecution(data: Omit<ExecutionData, 'id' | 'createdAt'>): ExecutionData {
    const exec: ExecutionData = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    this.executions.set(exec.id, exec);
    return exec;
  }

  getExecutionsByProject(projectId: string, limit: number = 50): ExecutionData[] {
    return Array.from(this.executions.values())
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

export const store = new InMemoryStore();
