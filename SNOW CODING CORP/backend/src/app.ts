import express from 'express';
import cors from 'cors';
import path from 'path';
import projectsRouter from './routes/projects';
import filesRouter from './routes/files';
import executionRouter from './routes/execution';
import languagesRouter from './routes/languages';
import { getAllowedOrigins } from './config/runtime';

const app = express();
const allowedOrigins = getAllowedOrigins();

// Middleware
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ success: false, error: 'Origin is not allowed' });
    return;
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
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

export default app;
