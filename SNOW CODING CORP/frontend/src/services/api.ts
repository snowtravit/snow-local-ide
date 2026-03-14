import axios from 'axios';
import type { ApiResponse, Project, ProjectFile, Language, ExecutionResult, ExecutionHistory } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// --- Languages ---

export async function getLanguages(): Promise<Language[]> {
  const { data } = await api.get<ApiResponse<Language[]>>('/languages');
  return data.data || [];
}

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get<ApiResponse<Project[]>>('/projects');
  return data.data || [];
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
  return data.data!;
}

export async function createProject(params: {
  name: string;
  description?: string;
  languages: string[];
}): Promise<Project> {
  const { data } = await api.post<ApiResponse<Project>>('/projects', params);
  return data.data!;
}

export async function updateProject(id: string, params: Partial<Project>): Promise<Project> {
  const { data } = await api.put<ApiResponse<Project>>(`/projects/${id}`, params);
  return data.data!;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// --- Files ---

export async function getFiles(projectId: string): Promise<ProjectFile[]> {
  const { data } = await api.get<ApiResponse<ProjectFile[]>>(`/files/${projectId}`);
  return data.data || [];
}

export async function getFile(projectId: string, fileId: string): Promise<ProjectFile> {
  const { data } = await api.get<ApiResponse<ProjectFile>>(`/files/${projectId}/${fileId}`);
  return data.data!;
}

export async function createFile(projectId: string, params: {
  name: string;
  path: string;
  content?: string;
  language: string;
}): Promise<ProjectFile> {
  const { data } = await api.post<ApiResponse<ProjectFile>>(`/files/${projectId}`, params);
  return data.data!;
}

export async function updateFile(projectId: string, fileId: string, params: {
  content?: string;
  name?: string;
}): Promise<ProjectFile> {
  const { data } = await api.put<ApiResponse<ProjectFile>>(`/files/${projectId}/${fileId}`, params);
  return data.data!;
}

export async function deleteFile(projectId: string, fileId: string): Promise<void> {
  await api.delete(`/files/${projectId}/${fileId}`);
}

// --- Execution ---

export async function executeCode(params: {
  projectId?: string;
  language: string;
  files: Array<{ name: string; content: string }>;
  stdin?: string;
}): Promise<ExecutionResult> {
  const { data } = await api.post<ApiResponse<ExecutionResult>>('/execute', params);
  return data.data!;
}

export async function stopExecution(executionId: string): Promise<void> {
  await api.post('/execute/stop', { executionId });
}

export async function getExecutionHistory(projectId: string, limit?: number): Promise<ExecutionHistory[]> {
  const { data } = await api.get<ApiResponse<ExecutionHistory[]>>(
    `/execute/history/${projectId}${limit ? `?limit=${limit}` : ''}`
  );
  return data.data || [];
}

export async function getDockerStatus(): Promise<{ dockerAvailable: boolean; mode: string }> {
  const { data } = await api.get<ApiResponse<{ dockerAvailable: boolean; mode: string }>>('/execute/status');
  return data.data!;
}
