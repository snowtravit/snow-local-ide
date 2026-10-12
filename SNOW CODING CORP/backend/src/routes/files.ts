import { Router, Request, Response } from 'express';
import { store } from '../services/InMemoryStore';
import path from 'path';
import { getLanguageById } from '../config/languages';
import { FileService, FileValidationError } from '../services/FileService';

const router = Router();

// GET /api/files/:projectId - List all files in a project
router.get('/:projectId', (req: Request, res: Response) => {
  try {
    const files = store.getFilesByProject(req.params.projectId);
    res.json({ success: true, data: files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// POST /api/files/:projectId - Create a new file
router.post('/:projectId', (req: Request, res: Response) => {
  try {
    const { name, path: filePath, content, language } = req.body;
    if (typeof name !== 'string' || !name || typeof filePath !== 'string' ||
      typeof language !== 'string' || !getLanguageById(language) ||
      (content !== undefined && typeof content !== 'string')) {
      res.status(400).json({ success: false, error: 'name, path, and language are required' });
      return;
    }

    FileService.validateRelativePath(name);
    FileService.validateRelativePath(filePath);
    const project = store.getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (store.getFilesByProject(project.id).some((file) => file.path === filePath) ||
      FileService.exists(project.id, filePath)) {
      res.status(409).json({ success: false, error: 'A file already exists at this path' });
      return;
    }
    FileService.writeFile(project.id, filePath, content ?? '');
    const file = store.createFile({
      projectId: req.params.projectId,
      name,
      path: filePath,
      content: content ?? '',
      language,
    });

    res.status(201).json({ success: true, data: file });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// GET /api/files/:projectId/:fileId - Get file content
router.get('/:projectId/:fileId', (req: Request, res: Response) => {
  try {
    const file = store.getFile(req.params.fileId);
    if (!file || file.projectId !== req.params.projectId) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    // Try to read from disk first, fallback to stored content
    try {
      const content = FileService.readFile(req.params.projectId, file.path);
      res.json({ success: true, data: { ...file, content } });
    } catch {
      res.json({ success: true, data: file });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// PUT /api/files/:projectId/:fileId - Update file content
router.put('/:projectId/:fileId', (req: Request, res: Response) => {
  try {
    const { content, name } = req.body;
    const file = store.getFile(req.params.fileId);
    if (!file || file.projectId !== req.params.projectId) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    if ((content !== undefined && typeof content !== 'string') ||
      (name !== undefined && typeof name !== 'string')) {
      res.status(400).json({ success: false, error: 'name and content must be strings' });
      return;
    }
    if (name !== undefined) FileService.validateRelativePath(name);
    const newPath = name === undefined ? file.path :
      (name.includes('/') ? name : path.posix.join(path.posix.dirname(file.path), name));
    FileService.validateRelativePath(newPath);
    if (newPath !== file.path && (store.getFilesByProject(file.projectId)
      .some((entry) => entry.id !== file.id && entry.path === newPath) ||
      FileService.exists(file.projectId, newPath))) {
      res.status(409).json({ success: false, error: 'A file already exists at this path' });
      return;
    }
    if (newPath !== file.path) {
      FileService.rename(file.projectId, file.path, newPath);
      try {
        if (content !== undefined) FileService.writeFile(file.projectId, newPath, content);
      } catch (error) {
        FileService.rename(file.projectId, newPath, file.path);
        throw error;
      }
    } else if (content !== undefined) {
      FileService.writeFile(file.projectId, file.path, content);
    }
    const updateData: Record<string, string> = { path: newPath };
    if (content !== undefined) updateData.content = content;
    if (name !== undefined) updateData.name = name;

    const updated = store.updateFile(req.params.fileId, updateData);


    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

// DELETE /api/files/:projectId/:fileId - Delete a file
router.delete('/:projectId/:fileId', (req: Request, res: Response) => {
  try {
    const file = store.getFile(req.params.fileId);
    if (!file || file.projectId !== req.params.projectId) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    FileService.deleteFile(req.params.projectId, file.path);
    store.deleteFile(req.params.fileId);
    res.json({ success: true, message: 'File deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(error instanceof FileValidationError ? 400 : 500).json({ success: false, error: message });
  }
});

export default router;
