import React from 'react';
import type { ExecutionStatus } from '../../types';

interface HeaderProps {
  dockerStatus: ExecutionStatus | null;
}

export const Header: React.FC<HeaderProps> = ({ dockerStatus }) => {

  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-3 glass-panel-light mx-3 mt-3 mb-2">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/logo/avatar.jpg"
          alt="SNOW IDE"
          className="w-9 h-9 rounded-lg object-cover shadow-lg shadow-white/10"
        />
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">SNOW IDE</h1>
          <p className="text-xs text-ide-text-muted -mt-0.5">Professional Code Editor</p>
        </div>
      </div>

      {/* Center info */}
      <div className="flex items-center gap-4">
        {dockerStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-panel-light">
            <div className={`w-2 h-2 rounded-full ${
              dockerStatus.mode === 'docker'
                ? 'bg-green-400 shadow-green-400/50 shadow-sm'
                : dockerStatus.mode === 'local'
                ? 'bg-blue-400 shadow-blue-400/50 shadow-sm'
                : 'bg-yellow-400 shadow-yellow-400/50 shadow-sm'
            }`} />
            <span className="text-xs text-ide-text-muted">
              {dockerStatus.mode === 'docker'
                ? 'Docker Connected'
                : dockerStatus.mode === 'local'
                ? 'Local Execution (host permissions)'
                : dockerStatus.configuredMode === 'docker'
                ? 'Docker Unavailable'
                : 'Local Runtime Unavailable'}
            </span>
          </div>
        )}
      </div>

      <div />
    </header>
  );
};
