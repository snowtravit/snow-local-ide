import app from './app';
import { FileService } from './services/FileService';
import { getExecutionMode } from './config/runtime';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '127.0.0.1';

// Initialize services and start server
async function start(): Promise<void> {
  const mode = getExecutionMode();
  // Initialize file service
  FileService.init();
  console.log('[Server] File service initialized');
  console.log(`[Server] Execution mode: ${mode}`);
  if (mode === 'local') {
    console.warn('[Server] Local execution runs with host user permissions. Run only your own trusted code.');
  }

  // Start server
  app.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(`  SNOW IDE Backend`);
    console.log(`  Running on http://${HOST}:${PORT}`);
    console.log(`  API: http://localhost:${PORT}/api`);
    console.log(`========================================\n`);
  });
}

start().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});

export default app;
