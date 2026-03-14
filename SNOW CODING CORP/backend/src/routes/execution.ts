import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DockerService } from '../services/DockerService';
import { LocalExecutionService } from '../services/LocalExecutionService';
import { store } from '../services/InMemoryStore';
import { getLanguageById } from '../config/languages';

const router = Router();

// POST /api/execute - Execute code
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, language, files, stdin } = req.body;

    if (!language || !files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'language and files array are required',
      });
      return;
    }

    const langConfig = getLanguageById(language);
    if (!langConfig) {
      res.status(400).json({
        success: false,
        error: `Unsupported language: ${language}`,
      });
      return;
    }

    const executionId = uuidv4();
    let result;

    // Try Docker first
    const dockerAvailable = await DockerService.isAvailable();
    if (dockerAvailable) {
      try {
        result = await DockerService.executeCode(langConfig, files, executionId, stdin);
        // If Docker returned an image-not-found error, fall through to local execution
        if (result.status === 'error' && result.output.includes('No such image')) {
          result = undefined;
        }
      } catch {
        // Docker execution failed, fall through to local execution
        result = undefined;
      }
    }

    // Try local execution if Docker didn't work
    if (!result) {
      const localResult = await LocalExecutionService.executeCode(langConfig, files, stdin);
      if (localResult) {
        result = localResult;
      } else {
        // No runtime available at all
        result = {
          output: `[Error] No runtime available for ${langConfig.name}.\n\nTo run ${langConfig.name} code, either:\n  1. Install ${langConfig.name} on your system\n  2. Or install Docker for full multi-language support\n\nYour code was NOT executed.`,
          exitCode: 1,
          executionTime: 0,
          status: 'error' as const,
        };
      }
    }

    // Save execution history
    if (projectId) {
      store.createExecution({
        projectId,
        language,
        code: files.map((f: { content: string }) => f.content).join('\n'),
        output: result.output,
        exitCode: result.exitCode,
        executionTime: result.executionTime,
        status: result.status,
      });
    }

    res.json({ success: true, data: { ...result, executionId } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/execute/stop - Stop a running execution
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.body;
    if (!executionId) {
      res.status(400).json({ success: false, error: 'executionId is required' });
      return;
    }

    const stopped = await DockerService.stopExecution(executionId);
    res.json({ success: true, stopped });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/execute/history/:projectId - Get execution history
router.get('/history/:projectId', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = store.getExecutionsByProject(req.params.projectId, limit);
    res.json({ success: true, data: executions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/execute/status - Check Docker status and local runtimes
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dockerAvailable = await DockerService.isAvailable();
    const localRuntimes = await LocalExecutionService.getAvailableRuntimes();
    const hasLocalRuntimes = Object.values(localRuntimes).some(Boolean);

    let mode = 'unavailable';
    if (dockerAvailable) mode = 'docker';
    else if (hasLocalRuntimes) mode = 'local';

    res.json({
      success: true,
      data: {
        dockerAvailable,
        localRuntimes,
        mode,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
