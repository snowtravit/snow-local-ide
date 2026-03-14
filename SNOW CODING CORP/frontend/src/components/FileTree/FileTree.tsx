import React, { useState } from 'react';
import { File, FolderOpen, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import type { ProjectFile, Language } from '../../types';

interface FileTreeProps {
  files: ProjectFile[];
  activeFileId: string | null;
  languages: Language[];
  onSelectFile: (file: ProjectFile) => void;
  onCreateFile: (name: string, language: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
}

const fileIcons: Record<string, string> = {
  python: '🐍',
  java: '☕',
  javascript: '⚡',
  cpp: '⚙️',
  csharp: '🔷',
  go: '🔵',
  php: '🐘',
  html: '🌐',
};

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFileId,
  languages,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
}) => {
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreateFile = () => {
    if (newFileName.trim() && newFileLang) {
      onCreateFile(newFileName.trim(), newFileLang);
      setNewFileName('');
      setNewFileLang('');
      setShowNewFile(false);
    }
  };

  const handleRename = (fileId: string) => {
    if (renameValue.trim()) {
      onRenameFile(fileId, renameValue.trim());
      setRenamingId(null);
      setRenameValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-ide-text-muted uppercase tracking-wider">
          <FolderOpen size={14} />
          Files
        </div>
        <button
          onClick={() => setShowNewFile(!showNewFile)}
          className="p-1 rounded hover:bg-white/10 text-ide-text-muted hover:text-white transition-colors"
          title="New File"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* New file form */}
      {showNewFile && (
        <div className="p-3 border-b border-white/5 animate-in">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.ext"
            className="input-glass text-xs mb-2"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
          />
          <select
            value={newFileLang}
            onChange={(e) => setNewFileLang(e.target.value)}
            className="input-glass text-xs mb-2"
          >
            <option value="">Select language...</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreateFile} className="btn-primary text-xs flex-1 justify-center">
              <Check size={12} /> Create
            </button>
            <button onClick={() => setShowNewFile(false)} className="btn-glass text-xs">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-ide-text-muted">
            No files yet. Click + to create one.
          </div>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            className={`
              group flex items-center gap-2 px-4 py-2 cursor-pointer transition-all
              ${activeFileId === file.id
                ? 'bg-snow-accent/15 text-white border-r-2 border-snow-accent'
                : 'text-ide-text-muted hover:bg-white/5 hover:text-white border-r-2 border-transparent'
              }
            `}
            onClick={() => onSelectFile(file)}
          >
            <span className="text-sm">{fileIcons[file.language] || '📄'}</span>

            {renamingId === file.id ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-white outline-none flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(file.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRename(file.id); }}
                  className="p-0.5 hover:text-green-400"
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs font-medium truncate">
                  <File size={12} className="inline mr-1 opacity-50" />
                  {file.name}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(file.id);
                      setRenameValue(file.name);
                    }}
                    className="p-0.5 hover:text-blue-400 transition-colors"
                    title="Rename"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file.id);
                    }}
                    className="p-0.5 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
