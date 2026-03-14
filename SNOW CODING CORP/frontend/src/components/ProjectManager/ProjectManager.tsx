import React, { useState } from 'react';
import { FolderPlus, Trash2, ChevronRight } from 'lucide-react';
import { LanguageSelector } from '../LanguageSelector/LanguageSelector';
import type { Project, Language } from '../../types';

interface ProjectManagerProps {
  projects: Project[];
  languages: Language[];
  onCreateProject: (name: string, description: string, languages: string[]) => void;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  languages,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

  const handleCreate = () => {
    if (name.trim() && selectedLangs.length > 0) {
      onCreateProject(name.trim(), description.trim(), selectedLangs);
      setName('');
      setDescription('');
      setSelectedLangs([]);
      setShowCreate(false);
    }
  };

  const toggleLanguage = (langId: string) => {
    setSelectedLangs((prev) =>
      prev.includes(langId) ? prev.filter((l) => l !== langId) : [...prev, langId]
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      {/* Hero section */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="flex items-center justify-center mb-6">
          <img
            src="/logo/avatar.jpg"
            alt="SNOW IDE"
            className="w-20 h-20 rounded-2xl object-cover shadow-2xl shadow-white/20"
          />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">SNOW IDE</h1>
        <p className="text-lg text-ide-text-muted max-w-md">
          Professional code editor with multi-language support and isolated execution
        </p>
      </div>

      {/* Create or select */}
      {!showCreate ? (
        <div className="w-full max-w-2xl">
          {/* Create new button */}
          <button
            onClick={() => setShowCreate(true)}
            className="w-full glass-panel p-6 flex items-center gap-4 hover:bg-white/8 transition-all group mb-6"
          >
            <div className="w-12 h-12 rounded-xl bg-snow-accent/20 flex items-center justify-center group-hover:bg-snow-accent/30 transition-colors">
              <FolderPlus size={24} className="text-snow-accent" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-white font-semibold text-lg">New Project</h3>
              <p className="text-ide-text-muted text-sm">Create a new coding project</p>
            </div>
            <ChevronRight size={20} className="text-ide-text-muted group-hover:text-white transition-colors" />
          </button>

          {/* Existing projects */}
          {projects.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ide-text-muted uppercase tracking-wider mb-3 px-1">
                Recent Projects
              </h3>
              <div className="space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="glass-panel-light p-4 flex items-center gap-4 cursor-pointer hover:bg-white/8 transition-all group"
                    onClick={() => onSelectProject(project)}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden">
                      <img src="/logo/avatar.jpg" alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{project.name}</h4>
                      <p className="text-xs text-ide-text-muted truncate">
                        {project.languages.join(', ')} · {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-ide-text-muted hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-ide-text-muted group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Create project form */
        <div className="w-full max-w-2xl glass-panel p-8 animate-in">
          <h2 className="text-xl font-bold text-white mb-6">Create New Project</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ide-text-muted mb-2">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Project"
                className="input-glass"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ide-text-muted mb-2">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description..."
                className="input-glass"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ide-text-muted mb-3">
                Select Languages <span className="text-xs opacity-60">(choose one or more)</span>
              </label>
              <LanguageSelector
                languages={languages}
                selectedLanguages={selectedLangs}
                onToggleLanguage={toggleLanguage}
                mode="multi"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || selectedLangs.length === 0}
                className={`btn-primary flex-1 justify-center ${(!name.trim() || selectedLangs.length === 0) ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <FolderPlus size={16} />
                Create Project
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-glass">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
