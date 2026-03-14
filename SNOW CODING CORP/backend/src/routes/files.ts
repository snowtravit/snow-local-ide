import { Router, Request, Response } from 'express';
import { store } from '../services/InMemoryStore';
import { FileService } from '../services/FileService';

const router = Router();

// GET /api/files/:projectId - List all files in a project
router.get('/:projectId', (req: Request, res: Response) => {
  try {
    const files = store.getFilesByProject(req.params.projectId);
    res.json({ success: true, data: files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/files/:projectId - Create a new file
router.post('/:projectId', (req: Request, res: Response) => {
  try {
    const { name, path: filePath, content, language } = req.body;
    if (!name || !filePath || !language) {
      res.status(400).json({ success: false, error: 'name, path, and language are required' });
      return;
    }

    const project = store.getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const file = store.createFile({
      projectId: req.params.projectId,
      name,
      path: filePath,
      content: content || '',
      language,
    });

    FileService.writeFile(req.params.projectId, filePath, content || '');
    res.status(201).json({ success: true, data: file });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
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
    res.status(500).json({ success: false, error: message });
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

    const updateData: Record<string, string> = {};
    if (content !== undefined) updateData.content = content;
    if (name !== undefined) updateData.name = name;

    const updated = store.updateFile(req.params.fileId, updateData);
    if (updated && content !== undefined) {
      FileService.writeFile(req.params.projectId, updated.path, content);
    }

    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
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

    store.deleteFile(req.params.fileId);
    FileService.deleteFile(req.params.projectId, file.path);
    res.json({ success: true, message: 'File deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
