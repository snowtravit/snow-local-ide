export type ExecutionMode = 'docker' | 'local';

export function getExecutionMode(): ExecutionMode {
  const mode = process.env.EXECUTION_MODE || 'docker';
  if (mode !== 'docker' && mode !== 'local') {
    throw new Error('EXECUTION_MODE must be docker or local');
  }
  return mode;
}

export function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:4000,http://127.0.0.1:4000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
