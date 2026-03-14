export interface Language {
  id: string;
  name: string;
  extension: string;
  monacoLanguage: string;
  defaultCode: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  languages: string[];
  files?: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResult {
  output: string;
  exitCode: number;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
  executionId?: string;
}

export interface ExecutionHistory {
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
