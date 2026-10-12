import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Save, ArrowLeft } from 'lucide-react';
import { Background } from './components/Background/Background';
import { Header } from './components/Header/Header';
import { FileTree } from './components/FileTree/FileTree';
import { Console } from './components/Console/Console';
import { ProjectManager } from './components/ProjectManager/ProjectManager';
import * as api from './services/api';
import type { Language, Project, ProjectFile, ExecutionResult, ExecutionStatus } from './types';

const CodeEditor = React.lazy(() => import('./components/Editor/CodeEditor').then((module) => ({ default: module.CodeEditor })));

interface EditorSnapshot {
  file: ProjectFile;
  content: string;
}

interface ActiveExecution {
  id: string;
  projectId: string;
  controller: AbortController;
  started: boolean;
  stopped: boolean;
}

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
  const [isStopping, setIsStopping] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryLoad, setRetryLoad] = useState<'initial' | 'files' | null>(null);
  const [loadAttempts, setLoadAttempts] = useState({ initial: 0, files: 0 });
  const [dockerStatus, setDockerStatus] = useState<ExecutionStatus | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string>('');
  const currentProjectRef = useRef<Project | null>(null);
  const editorRef = useRef<EditorSnapshot | null>(null);
  const projectRequest = useRef(0);
  const fileRequest = useRef(0);
  const drafts = useRef(new Map<string, string>());
  const saveQueue = useRef(new Map<string, Promise<void>>());
  const queuedContent = useRef(new Map<string, string>());
  const activeExecution = useRef<ActiveExecution | null>(null);

  const reportError = useCallback((message: string, error: unknown) => {
    setErrorMessage(`${message}: ${api.getErrorMessage(error)}`);
    setRetryLoad(null);
  }, []);

  const showFile = useCallback((file: ProjectFile | null) => {
    const content = file ? drafts.current.get(file.id) ?? file.content : '';
    editorRef.current = file ? { file, content } : null;
    setActiveFile(file);
    setEditorContent(content);
    setActiveLanguage(file?.language ?? '');
  }, []);

  const showProject = useCallback((project: Project | null) => {
    currentProjectRef.current = project;
    fileRequest.current += 1;
    setCurrentProject(project);
    setFiles([]);
    showFile(null);
    setOutput(null);
    setStdinInput('');
    setIsLoadingFiles(Boolean(project));
  }, [showFile]);

  // Serialize writes to one file so a slow older save cannot replace newer text.
  const saveSnapshot = useCallback(async (snapshot: EditorSnapshot) => {
    const { file, content } = snapshot;
    const pending = saveQueue.current.get(file.id);
    if (pending && queuedContent.current.get(file.id) === content) {
      await pending;
      return;
    }
    const previous = saveQueue.current.get(file.id) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      await api.updateFile(file.projectId, file.id, { content });
      if (drafts.current.get(file.id) === content) drafts.current.delete(file.id);
      if (currentProjectRef.current?.id !== file.projectId) return;
      setFiles((prev) => prev.map((item) => item.id === file.id ? { ...item, content } : item));
      if (editorRef.current?.file.id === file.id) {
        editorRef.current = {
          ...editorRef.current,
          file: { ...editorRef.current.file, content },
        };
        setActiveFile((prev) => prev?.id === file.id ? { ...prev, content } : prev);
      }
    });
    saveQueue.current.set(file.id, operation);
    queuedContent.current.set(file.id, content);
    try {
      await operation;
    } finally {
      if (saveQueue.current.get(file.id) === operation) {
        saveQueue.current.delete(file.id);
        queuedContent.current.delete(file.id);
      }
    }
  }, []);

  const saveCurrentFile = useCallback(async () => {
    // Keep edits made while an earlier save is in flight as well.
    let snapshot = editorRef.current;
    while (snapshot && snapshot.content !== snapshot.file.content) {
      await saveSnapshot(snapshot);
      const current = editorRef.current;
      if (current?.file.id !== snapshot.file.id) return;
      snapshot = current;
    }
  }, [saveSnapshot]);

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const [langs, projs, status] = await Promise.allSettled([
          api.getLanguages(),
          api.getProjects(),
          api.getDockerStatus(),
        ]);
        if (cancelled) return;
        if (langs.status === 'fulfilled') setLanguages(langs.value);
        if (projs.status === 'fulfilled') setProjects(projs.value);
        if (status.status === 'fulfilled') setDockerStatus(status.value);
        const failures = [langs, projs, status].flatMap((result) => result.status === 'rejected' ? [api.getErrorMessage(result.reason)] : []);
        if (failures.length > 0) {
          setErrorMessage(`Failed to load some project data: ${failures.join('; ')}`);
          setRetryLoad('initial');
        }
      } catch (error) {
        if (!cancelled) {
          reportError('Failed to load projects', error);
          setRetryLoad('initial');
        }
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [loadAttempts.initial, reportError]);

  // Load project files when project changes
  useEffect(() => {
    let cancelled = false;
    if (currentProject) {
      const projectId = currentProject.id;
      setIsLoadingFiles(true);
      const loadFiles = async () => {
        try {
          const projectFiles = await api.getFiles(projectId);
          if (cancelled || currentProjectRef.current?.id !== projectId) return;
          setFiles(projectFiles);
          if (!editorRef.current) showFile(projectFiles[0] ?? null);
        } catch (error) {
          if (!cancelled) {
            reportError('Failed to load files', error);
            setRetryLoad('files');
          }
        } finally {
          if (!cancelled && currentProjectRef.current?.id === projectId) setIsLoadingFiles(false);
        }
      };
      loadFiles();
    }
    return () => { cancelled = true; };
  }, [currentProject, loadAttempts.files, reportError, showFile]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (drafts.current.size === 0 && !activeExecution.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      activeExecution.current?.controller.abort();
    };
  }, []);

  // Handlers
  const handleCreateProject = useCallback(async (name: string, description: string, selectedLangs: string[]) => {
    const request = ++projectRequest.current;
    setErrorMessage(null);
    try {
      await saveCurrentFile();
      const project = await api.createProject({ name, description, languages: selectedLangs });
      setProjects((prev) => [project, ...prev]);
      if (request === projectRequest.current) showProject(project);
      return true;
    } catch (error) {
      if (request === projectRequest.current) reportError('Failed to create project', error);
      return false;
    }
  }, [reportError, saveCurrentFile, showProject]);

  const handleSelectProject = useCallback(async (project: Project) => {
    const request = ++projectRequest.current;
    setErrorMessage(null);
    try {
      await saveCurrentFile();
      const fullProject = await api.getProject(project.id);
      if (request === projectRequest.current) showProject(fullProject);
    } catch (error) {
      if (request === projectRequest.current) reportError('Failed to load project', error);
    }
  }, [reportError, saveCurrentFile, showProject]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (currentProjectRef.current?.id === id) showProject(null);
    } catch (error) {
      reportError('Failed to delete project', error);
    }
  }, [reportError, showProject]);

  const handleSelectFile = useCallback(async (file: ProjectFile) => {
    if (file.projectId !== currentProjectRef.current?.id) return;
    const request = ++fileRequest.current;
    if (editorRef.current?.file.id === file.id) return;
    setErrorMessage(null);
    try {
      await saveCurrentFile();
      if (request !== fileRequest.current || file.projectId !== currentProjectRef.current?.id) return;
      const fullFile = await api.getFile(file.projectId, file.id);
      if (request === fileRequest.current && file.projectId === currentProjectRef.current?.id) showFile(fullFile);
    } catch (error) {
      if (request === fileRequest.current) reportError('Failed to open file; current edits are kept', error);
    }
  }, [reportError, saveCurrentFile, showFile]);

  const handleCreateFile = useCallback(async (name: string, language: string) => {
    const projectId = currentProjectRef.current?.id;
    if (!projectId || isLoadingFiles) return false;
    const request = ++fileRequest.current;
    setErrorMessage(null);
    try {
      await saveCurrentFile();
      const lang = languages.find((l) => l.id === language);
      const file = await api.createFile(projectId, {
        name,
        path: name,
        content: lang?.defaultCode || '',
        language,
      });
      if (currentProjectRef.current?.id !== projectId) return true;
      setFiles((prev) => [...prev, file]);
      if (request === fileRequest.current) showFile(file);
      return true;
    } catch (error) {
      if (request === fileRequest.current) reportError('Failed to create file; current edits are kept', error);
      return false;
    }
  }, [isLoadingFiles, languages, reportError, saveCurrentFile, showFile]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    const projectId = currentProjectRef.current?.id;
    if (!projectId) return;
    const request = ++fileRequest.current;
    setErrorMessage(null);
    try {
      // Wait for prior saves before deleting so they cannot recreate a stale write.
      await saveQueue.current.get(fileId)?.catch(() => undefined);
      await api.deleteFile(projectId, fileId);
      drafts.current.delete(fileId);
      if (currentProjectRef.current?.id !== projectId) return;
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (editorRef.current?.file.id === fileId) showFile(null);
    } catch (error) {
      if (request === fileRequest.current) reportError('Failed to delete file', error);
    }
  }, [reportError, showFile]);

  const handleRenameFile = useCallback(async (fileId: string, newName: string) => {
    const projectId = currentProjectRef.current?.id;
    if (!projectId) return;
    setErrorMessage(null);
    try {
      const updated = await api.updateFile(projectId, fileId, { name: newName });
      if (currentProjectRef.current?.id !== projectId) return;
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, name: updated.name, path: updated.path } : f));
      if (editorRef.current?.file.id === fileId) {
        editorRef.current = { ...editorRef.current, file: { ...editorRef.current.file, name: updated.name, path: updated.path } };
        setActiveFile((prev) => prev?.id === fileId ? { ...prev, name: updated.name, path: updated.path } : prev);
      }
    } catch (error) {
      reportError('Failed to rename file', error);
    }
  }, [reportError]);

  const handleSave = useCallback(async () => {
    setErrorMessage(null);
    try {
      await saveCurrentFile();
    } catch (error) {
      reportError('Failed to save; current edits are kept', error);
    }
  }, [reportError, saveCurrentFile]);

  const handleEditorChange = useCallback((content: string) => {
    const snapshot = editorRef.current;
    if (!snapshot) return;
    editorRef.current = { ...snapshot, content };
    if (content === snapshot.file.content) drafts.current.delete(snapshot.file.id);
    else drafts.current.set(snapshot.file.id, content);
    setEditorContent(content);
  }, []);

  const handleRun = useCallback(async () => {
    const snapshot = editorRef.current;
    const projectId = currentProjectRef.current?.id;
    if (!snapshot || !projectId || activeExecution.current) return;
    const execution: ActiveExecution = {
      id: crypto.randomUUID(), projectId, controller: new AbortController(), started: false, stopped: false,
    };
    activeExecution.current = execution;
    setIsRunning(true);
    setIsStopping(false);
    setOutput(null);
    setErrorMessage(null);

    try {
      await saveSnapshot(snapshot);
      if (execution.stopped) throw new Error('Execution stopped');
      execution.started = true;
      const result = await api.executeCode({
        executionId: execution.id,
        projectId,
        language: snapshot.file.language,
        files: [snapshot.file, ...files.filter((file) => file.id !== snapshot.file.id)].map((file) => ({
          name: file.path || file.name,
          content: file.id === snapshot.file.id ? snapshot.content : drafts.current.get(file.id) ?? file.content,
        })),
        stdin: stdinInput || undefined,
      }, execution.controller.signal);
      if (currentProjectRef.current?.id === projectId) setOutput(result);
    } catch (error) {
      if (currentProjectRef.current?.id === projectId) setOutput({
        output: execution.stopped ? 'Execution stopped' : `Error: ${api.getErrorMessage(error)}`,
        exitCode: execution.stopped ? 137 : 1,
        executionTime: 0,
        status: 'error',
        executionId: execution.id,
      });
    } finally {
      if (activeExecution.current === execution) {
        activeExecution.current = null;
        setIsRunning(false);
        setIsStopping(false);
      }
    }
  }, [files, saveSnapshot, stdinInput]);

  const handleStop = useCallback(async () => {
    const execution = activeExecution.current;
    if (!execution || execution.stopped) return;
    execution.stopped = true;
    setIsStopping(true);
    try {
      if (execution.started) await api.stopExecution(execution.id);
    } catch (error) {
      reportError('Stop request failed; cancelling the execution connection', error);
    } finally {
      execution.controller.abort();
    }
  }, [reportError]);

  const handleBackToProjects = useCallback(async () => {
    if (activeExecution.current) return;
    const request = ++projectRequest.current;
    setErrorMessage(null);
    try {
      await saveCurrentFile();
      if (request === projectRequest.current) showProject(null);
    } catch (error) {
      reportError('Failed to save; stay here to retry before leaving', error);
    }
  }, [reportError, saveCurrentFile, showProject]);

  // Get active language config for Monaco
  const activeMonacoLanguage = languages.find((l) => l.id === activeLanguage)?.monacoLanguage || 'plaintext';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Animated background */}
      <Background />

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full">
        <Header dockerStatus={dockerStatus} />

        {errorMessage && (
          <div role="alert" className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-950/80 px-4 py-2 text-sm text-red-100">
            <span>{errorMessage}</span>
            <div className="flex gap-2">
              {retryLoad && <button onClick={() => {
                setLoadAttempts((prev) => ({ ...prev, [retryLoad]: prev[retryLoad] + 1 }));
                setErrorMessage(null);
                setRetryLoad(null);
              }} className="btn-glass text-xs">Retry</button>}
              <button onClick={() => { setErrorMessage(null); setRetryLoad(null); }} className="btn-glass text-xs">Dismiss</button>
            </div>
          </div>
        )}

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
                <button onClick={handleBackToProjects} className="btn-glass text-xs" disabled={isRunning}>
                  <ArrowLeft size={14} />
                  Projects
                </button>
                <div className="h-5 w-px bg-white/10" />
                <span className="text-sm font-semibold text-white">{currentProject.name}</span>
                {activeFile && (
                  <>
                    <span className="text-ide-text-muted text-sm">/</span>
                    <span className="text-sm text-snow-accent">{activeFile.name}</span>
                    {editorContent !== activeFile.content && <span className="text-xs text-ide-text-muted">Unsaved</span>}
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
                  <button onClick={handleStop} className="btn-danger text-xs" disabled={isStopping}>
                    <Square size={14} />
                    {isStopping ? 'Stopping...' : 'Stop'}
                  </button>
                )}
              </div>
            </div>

            {/* Main IDE layout */}
            <div className="flex-1 flex gap-2 overflow-hidden">
              {/* Sidebar - File tree */}
              <div className="w-56 flex-shrink-0 glass-panel overflow-hidden">
                <FileTree
                  key={currentProject.id}
                  files={files}
                  isLoading={isLoadingFiles}
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
                    <React.Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-ide-text-muted">Loading editor...</div>}>
                      <CodeEditor
                        path={`${activeFile.projectId}/${activeFile.id}`}
                        value={editorContent}
                        language={activeMonacoLanguage}
                        onChange={handleEditorChange}
                        onSave={handleSave}
                      />
                    </React.Suspense>
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
