import React, { useRef, useEffect, useState } from 'react';
import { Terminal, X, Clock, CheckCircle, AlertCircle, Timer, KeyboardIcon } from 'lucide-react';
import type { ExecutionResult } from '../../types';

interface ConsoleProps {
  output: ExecutionResult | null;
  isRunning: boolean;
  onClear: () => void;
  stdin: string;
  onStdinChange: (value: string) => void;
}

export const Console: React.FC<ConsoleProps> = ({ output, isRunning, onClear, stdin, onStdinChange }) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const [showStdin, setShowStdin] = useState(false);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const getStatusIcon = () => {
    if (isRunning) {
      return <div className="w-3.5 h-3.5 border-2 border-snow-accent/30 border-t-snow-accent rounded-full animate-spin" />;
    }
    if (!output) return <Terminal size={14} className="text-ide-text-muted" />;
    switch (output.status) {
      case 'success': return <CheckCircle size={14} className="text-green-400" />;
      case 'error': return <AlertCircle size={14} className="text-red-400" />;
      case 'timeout': return <Timer size={14} className="text-yellow-400" />;
    }
  };

  const getStatusColor = () => {
    if (isRunning) return 'text-snow-accent';
    if (!output) return 'text-ide-text-muted';
    switch (output.status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'timeout': return 'text-yellow-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Console header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-xs font-semibold text-ide-text-muted uppercase tracking-wider">
            Console
          </span>
          {output && !isRunning && (
            <span className={`text-xs ${getStatusColor()}`}>
              — {output.status === 'success' ? 'Exit 0' : output.status === 'error' ? `Exit ${output.exitCode}` : 'Timeout'}
            </span>
          )}
          {isRunning && (
            <span className="text-xs text-snow-accent">Running...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {output && (
            <div className="flex items-center gap-1 text-xs text-ide-text-muted">
              <Clock size={11} />
              {output.executionTime}ms
            </div>
          )}
          <button
            onClick={() => setShowStdin(!showStdin)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showStdin
                ? 'bg-snow-accent/20 text-snow-accent border border-snow-accent/30'
                : 'hover:bg-white/10 text-ide-text-muted hover:text-white border border-transparent'
            }`}
            title="Toggle stdin input"
          >
            <KeyboardIcon size={12} />
            <span>Input</span>
          </button>
          <button
            onClick={onClear}
            className="p-1 rounded hover:bg-white/10 text-ide-text-muted hover:text-white transition-colors"
            title="Clear"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Stdin input area */}
      {showStdin && (
        <div className="px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-ide-text-muted">Standard Input (stdin):</span>
            <span className="text-xs text-ide-text-muted opacity-50">Enter input data before running</span>
          </div>
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            placeholder="Enter input here (each line = one input)..."
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-green-100 font-mono placeholder-white/20 focus:outline-none focus:border-snow-accent/50 resize-none"
            rows={3}
            spellCheck={false}
          />
        </div>
      )}

      {/* Console output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-4">
        {isRunning && !output && (
          <div className="flex items-center gap-2 text-snow-accent text-sm">
            <div className="w-4 h-4 border-2 border-snow-accent/30 border-t-snow-accent rounded-full animate-spin" />
            <span>Executing code...</span>
          </div>
        )}

        {!output && !isRunning && (
          <div className="text-ide-text-muted text-sm flex items-center gap-2">
            <Terminal size={16} className="opacity-50" />
            <span>Click Run to execute your code</span>
          </div>
        )}

        {output && (
          <pre className={`console-output ${
            output.status === 'error' ? 'text-red-300' :
            output.status === 'timeout' ? 'text-yellow-300' :
            'text-green-100'
          }`}>
            {output.output || '[No output]'}
          </pre>
        )}
      </div>
    </div>
  );
};
