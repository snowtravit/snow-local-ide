import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DockerService } from '../services/DockerService';
import { LocalExecutionService } from '../services/LocalExecutionService';
import { store } from '../services/InMemoryStore';
import { getLanguageById } from '../config/languages';
import { getExecutionMode } from '../config/runtime';

const router = Router();

// POST /api/execute - Execute code
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, language, files, stdin } = req.body;

    if (typeof language !== 'string' || !language || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'language and files array are required',
      });
      return;
    }

    // Names are used as tar entries and local paths. Keep every file inside
    // the execution workspace and within the tar header's 100-byte name field.
    if (files.some((file: unknown) => {
      if (!file || typeof file !== 'object') return true;
      const { name, content } = file as { name?: unknown; content?: unknown };
      return typeof name !== 'string' || typeof content !== 'string' ||
        !/^[\p{L}\p{N}_ .\/-]+$/u.test(name) ||
        name.startsWith('/') || name.split('/').some((part) => !part || part === '.' || part === '..') ||
        Buffer.byteLength(name, 'utf8') > 100;
    }) || (stdin !== undefined && typeof stdin !== 'string')) {
      res.status(400).json({
        success: false,
        error: 'files must contain string content and safe relative names (up to 100 UTF-8 bytes); stdin must be a string',
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
    const mode = getExecutionMode();
    let result;

    // The configured mode is the only execution backend used for this request.
    if (mode === 'docker') {
      if (!await DockerService.isAvailable()) {
        res.status(503).json({
          success: false,
          mode,
          error: 'Docker is unavailable. Start Docker and check DOCKER_SOCKET, then retry. Code was not executed. Local execution requires explicitly starting the backend with EXECUTION_MODE=local and runs with your host user permissions.',
        });
        return;
      }
      try {
        result = await DockerService.executeCode(langConfig, files, executionId, stdin);
        if (result.status === 'error' && result.output.includes('No such image')) {
          result.output += `\n\nBuild the ${langConfig.image} image using docker/build-images.sh (or build-images.bat on Windows), then retry. No local execution was attempted.`;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Docker error';
        res.status(503).json({
          success: false,
          mode,
          error: `Docker execution failed: ${message}. Check Docker and the language image, then retry. No local execution was attempted.`,
        });
        return;
      }
    } else {
      result = await LocalExecutionService.executeCode(langConfig, files, stdin);
      if (!result) {
        res.status(503).json({
          success: false,
          mode,
          error: `No local runtime available for ${langConfig.name}. Install it on your system, or restart the backend with EXECUTION_MODE=docker and build the language image. Code was not executed.`,
        });
        return;
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

    res.json({ success: true, data: { ...result, executionId, mode } });
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

// GET /api/execute/status - Report availability of the configured execution mode
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const configuredMode = getExecutionMode();
    const dockerAvailable = await DockerService.isAvailable();
    const localRuntimes = configuredMode === 'local'
      ? await LocalExecutionService.getAvailableRuntimes()
      : {};
    const hasLocalRuntimes = Object.values(localRuntimes).some(Boolean);

    const available = configuredMode === 'docker' ? dockerAvailable : hasLocalRuntimes;
    const mode = available ? configuredMode : 'unavailable';

    res.json({
      success: true,
      data: {
        dockerAvailable,
        localRuntimes,
        configuredMode,
        mode,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
