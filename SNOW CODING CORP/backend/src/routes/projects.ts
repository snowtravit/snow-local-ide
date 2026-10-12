import { Router, Request, Response } from 'express';
import { store, ProjectData } from '../services/InMemoryStore';
import { FileService, FileValidationError } from '../services/FileService';
import { getAllLanguages, getLanguageById } from '../config/languages';

const router = Router();

// GET /api/projects - List all projects
router.get('/', (_req: Request, res: Response) => {
  try {
    const projects = store.getAllProjects();
    res.json({ success: true, data: projects });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// POST /api/projects - Create a new project
router.post('/', (req: Request, res: Response) => {
  let newProjectId: string | undefined;
  try {
    const { name, description, languages } = req.body;
    if (typeof name !== 'string' || !name.trim() ||
      (description !== undefined && typeof description !== 'string') ||
      (languages !== undefined && (!Array.isArray(languages) ||
        languages.some((id: unknown) => typeof id !== 'string' || !getLanguageById(id))))) {
      res.status(400).json({ success: false, error: 'Project name is required' });
      return;
    }

    const project = store.createProject({ name: name.trim(), description, languages: languages ? [...new Set(languages)] as string[] : [] });
    newProjectId = project.id;
    FileService.createProjectDir(project.id);

    // Create default files for selected languages
    if (project.languages.length) {
      for (const langId of project.languages) {
        const lang = getLanguageById(langId);
        if (lang) {
          const fileName = langId === 'html' ? `index${lang.extension}` :
                          langId === 'java' ? `Main${lang.extension}` :
                          `main${lang.extension}`;
          FileService.writeFile(project.id, fileName, lang.defaultCode);
          store.createFile({
            projectId: project.id,
            name: fileName,
            path: fileName,
            content: lang.defaultCode,
            language: langId,
          });
        }
      }
    }

    res.status(201).json({ success: true, data: project });
  } catch (error: unknown) {
    if (newProjectId) {
      store.deleteProject(newProjectId);
      try { FileService.deleteProject(newProjectId); } catch { /* Preserve the original disk error. */ }
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// GET /api/projects/:id - Get project details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = store.getProject(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const files = store.getFilesByProject(project.id);
    res.json({ success: true, data: { ...project, files } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, description, languages } = req.body;
    if ((name !== undefined && (typeof name !== 'string' || !name.trim())) ||
      (description !== undefined && typeof description !== 'string') ||
      (languages !== undefined && (!Array.isArray(languages) ||
        languages.some((id: unknown) => typeof id !== 'string' || !getLanguageById(id))))) {
      res.status(400).json({ success: false, error: 'Invalid project name, description, or languages' });
      return;
    }
    const update: Partial<ProjectData> = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (languages !== undefined) update.languages = [...new Set(languages)] as string[];
    const project = store.updateProject(req.params.id, update);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data: project });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', (req: Request, res: Response) => {
  try {
    if (!store.getProject(req.params.id)) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    FileService.deleteProject(req.params.id);
    store.deleteProject(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// GET /api/languages - List all supported languages
router.get('/languages/list', (_req: Request, res: Response) => {
  const languages = getAllLanguages();
  res.json({ success: true, data: languages });
});

export default router;
