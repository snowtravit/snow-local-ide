import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, Save, ArrowLeft } from 'lucide-react';
import { Background } from './components/Background/Background';
import { Header } from './components/Header/Header';
import { FileTree } from './components/FileTree/FileTree';
import { CodeEditor } from './components/Editor/CodeEditor';
import { Console } from './components/Console/Console';
import { ProjectManager } from './components/ProjectManager/ProjectManager';
import * as api from './services/api';
import type { Language, Project, ProjectFile, ExecutionResult } from './types';

export const App: React.FC = () => {
  // State
  const [languages, setLanguages] = useState<Language[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [stdinInput, setStdinInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [dockerStatus, setDockerStatus] = useState<{ dockerAvailable: boolean; mode: string } | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string>('');

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [langs, projs, status] = await Promise.all([
          api.getLanguages(),
          api.getProjects(),
          api.getDockerStatus(),
        ]);
        setLanguages(langs);
        setProjects(projs);
        setDockerStatus(status);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Load project files when project changes
  useEffect(() => {
    if (currentProject) {
      const loadFiles = async () => {
        try {
          const projectFiles = await api.getFiles(currentProject.id);
          setFiles(projectFiles);
          if (projectFiles.length > 0 && !activeFile) {
            const firstFile = projectFiles[0];
            setActiveFile(firstFile);
            setEditorContent(firstFile.content);
            setActiveLanguage(firstFile.language);
          }
        } catch (error) {
          console.error('Failed to load files:', error);
        }
      };
      loadFiles();
    }
  }, [currentProject]);

  // Handlers
  const handleCreateProject = useCallback(async (name: string, description: string, selectedLangs: string[]) => {
    try {
      const project = await api.createProject({ name, description, languages: selectedLangs });
      setProjects((prev) => [project, ...prev]);
      setCurrentProject(project);
      setFiles([]);
      setActiveFile(null);
      setOutput(null);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }, []);

  const handleSelectProject = useCallback(async (project: Project) => {
    try {
      const fullProject = await api.getProject(project.id);
      setCurrentProject(fullProject);
      setActiveFile(null);
      setEditorContent('');
      setOutput(null);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProject?.id === id) {
        setCurrentProject(null);
        setFiles([]);
        setActiveFile(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, [currentProject]);

  const handleSelectFile = useCallback(async (file: ProjectFile) => {
    // Save current file first
    if (activeFile && currentProject) {
      try {
        await api.updateFile(currentProject.id, activeFile.id, { content: editorContent });
      } catch (error) {
        console.error('Failed to save file:', error);
      }
    }

    try {
      const fullFile = await api.getFile(file.projectId, file.id);
      setActiveFile(fullFile);
      setEditorContent(fullFile.content);
      setActiveLanguage(fullFile.language);
    } catch {
      setActiveFile(file);
      setEditorContent(file.content);
      setActiveLanguage(file.language);
    }
  }, [activeFile, currentProject, editorContent]);

  const handleCreateFile = useCallback(async (name: string, language: string) => {
    if (!currentProject) return;
    try {
      const lang = languages.find((l) => l.id === language);
      const file = await api.createFile(currentProject.id, {
        name,
        path: name,
        content: lang?.defaultCode || '',
        language,
      });
      setFiles((prev) => [...prev, file]);
      setActiveFile(file);
      setEditorContent(file.content);
      setActiveLanguage(file.language);
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  }, [currentProject, languages]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!currentProject) return;
    try {
      await api.deleteFile(currentProject.id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFile?.id === fileId) {
        setActiveFile(null);
        setEditorContent('');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, [currentProject, activeFile]);

  const handleRenameFile = useCallback(async (fileId: string, newName: string) => {
    if (!currentProject) return;
    try {
      const updated = await api.updateFile(currentProject.id, fileId, { name: newName });
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, name: updated.name } : f)));
      if (activeFile?.id === fileId) {
        setActiveFile((prev) => (prev ? { ...prev, name: updated.name } : null));
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  }, [currentProject, activeFile]);

  const handleSave = useCallback(async () => {
    if (!activeFile || !currentProject) return;
    try {
      await api.updateFile(currentProject.id, activeFile.id, { content: editorContent });
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFile.id ? { ...f, content: editorContent } : f))
      );
    } catch (error) {
      console.error('Failed to save:', error);
    }
  }, [activeFile, currentProject, editorContent]);

  const handleRun = useCallback(async () => {
    if (!activeFile || isRunning) return;

    setIsRunning(true);
    setOutput(null);

    try {
      // Save first
      if (currentProject) {
        await api.updateFile(currentProject.id, activeFile.id, { content: editorContent });
      }

      const result = await api.executeCode({
        projectId: currentProject?.id,
        language: activeLanguage,
        files: [{ name: activeFile.name, content: editorContent }],
        stdin: stdinInput || undefined,
      });

      setOutput(result);
      if (result.executionId) {
        setExecutionId(result.executionId);
      }
    } catch (error) {
      setOutput({
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
        executionTime: 0,
        status: 'error',
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, isRunning, currentProject, editorContent, activeLanguage, stdinInput]);

  const handleStop = useCallback(async () => {
    if (executionId) {
      try {
        await api.stopExecution(executionId);
      } catch (error) {
        console.error('Failed to stop:', error);
      }
    }
    setIsRunning(false);
  }, [executionId]);

  const handleBackToProjects = useCallback(() => {
    setCurrentProject(null);
    setFiles([]);
    setActiveFile(null);
    setEditorContent('');
    setOutput(null);
  }, []);

  // Get active language config for Monaco
  const activeMonacoLanguage = languages.find((l) => l.id === activeLanguage)?.monacoLanguage || 'plaintext';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Animated background */}
      <Background />

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full">
        <Header dockerStatus={dockerStatus} />

        {!currentProject ? (
          /* Project selection screen */
          <div className="flex-1 overflow-y-auto">
            <ProjectManager
              projects={projects}
              languages={languages}
              onCreateProject={handleCreateProject}
              onSelectProject={handleSelectProject}
              onDeleteProject={handleDeleteProject}
            />
          </div>
        ) : (
          /* IDE workspace */
          <div className="flex-1 flex flex-col mx-3 mb-3 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 glass-panel-light mb-2">
              <div className="flex items-center gap-3">
                <button onClick={handleBackToProjects} className="btn-glass text-xs">
                  <ArrowLeft size={14} />
                  Projects
                </button>
                <div className="h-5 w-px bg-white/10" />
                <span className="text-sm font-semibold text-white">{currentProject.name}</span>
                {activeFile && (
                  <>
                    <span className="text-ide-text-muted text-sm">/</span>
                    <span className="text-sm text-snow-accent">{activeFile.name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSave} className="btn-glass text-xs" disabled={!activeFile}>
                  <Save size={14} />
                  Save
                </button>
                {!isRunning ? (
                  <button onClick={handleRun} className="btn-success text-xs" disabled={!activeFile}>
                    <Play size={14} />
                    Run
                  </button>
                ) : (
                  <button onClick={handleStop} className="btn-danger text-xs">
                    <Square size={14} />
                    Stop
                  </button>
                )}
              </div>
            </div>

            {/* Main IDE layout */}
            <div className="flex-1 flex gap-2 overflow-hidden">
              {/* Sidebar - File tree */}
              <div className="w-56 flex-shrink-0 glass-panel overflow-hidden">
                <FileTree
                  files={files}
                  activeFileId={activeFile?.id || null}
                  languages={languages}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onDeleteFile={handleDeleteFile}
                  onRenameFile={handleRenameFile}
                />
              </div>

              {/* Editor + Console */}
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                {/* Code editor */}
                <div className="flex-1 glass-panel overflow-hidden" style={{ minHeight: '50%' }}>
                  {activeFile ? (
                    <CodeEditor
                      value={editorContent}
                      language={activeMonacoLanguage}
                      onChange={setEditorContent}
                      onSave={handleSave}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-ide-text-muted">
                      <img src="/logo/avatar.jpg" alt="" className="w-12 h-12 rounded-xl object-cover mb-3 opacity-30" />
                      <p className="text-sm">Select a file or create a new one</p>
                    </div>
                  )}
                </div>

                {/* Console */}
                <div className="h-52 flex-shrink-0 glass-panel overflow-hidden">
                  <Console
                    output={output}
                    isRunning={isRunning}
                    onClear={() => setOutput(null)}
                    stdin={stdinInput}
                    onStdinChange={setStdinInput}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
