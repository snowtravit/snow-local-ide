import express from 'express';
import cors from 'cors';
import path from 'path';
import { FileService } from './services/FileService';
import projectsRouter from './routes/projects';
import filesRouter from './routes/files';
import executionRouter from './routes/execution';
import languagesRouter from './routes/languages';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets (background video/image)
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/files', filesRouter);
app.use('/api/execute', executionRouter);
app.use('/api/languages', languagesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Initialize services and start server
async function start(): Promise<void> {
  // Initialize file service
  FileService.init();
  console.log('[Server] File service initialized');

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
