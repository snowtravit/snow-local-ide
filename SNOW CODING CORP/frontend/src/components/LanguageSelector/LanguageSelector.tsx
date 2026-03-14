import React from 'react';
import type { Language } from '../../types';

interface LanguageSelectorProps {
  languages: Language[];
  selectedLanguages: string[];
  onToggleLanguage: (langId: string) => void;
  mode: 'single' | 'multi';
}

const languageIcons: Record<string, string> = {
  python: '🐍',
  java: '☕',
  javascript: '⚡',
  cpp: '⚙️',
  csharp: '🔷',
  go: '🔵',
  php: '🐘',
  html: '🌐',
};

const languageColors: Record<string, string> = {
  python: 'from-yellow-500/20 to-blue-500/20 border-yellow-500/30',
  java: 'from-red-500/20 to-orange-500/20 border-red-500/30',
  javascript: 'from-yellow-400/20 to-yellow-600/20 border-yellow-400/30',
  cpp: 'from-blue-500/20 to-blue-700/20 border-blue-500/30',
  csharp: 'from-purple-500/20 to-purple-700/20 border-purple-500/30',
  go: 'from-cyan-500/20 to-cyan-700/20 border-cyan-500/30',
  php: 'from-indigo-500/20 to-indigo-700/20 border-indigo-500/30',
  html: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages,
  selectedLanguages,
  onToggleLanguage,
  mode,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {languages.map((lang) => {
        const isSelected = selectedLanguages.includes(lang.id);
        const colors = languageColors[lang.id] || 'from-gray-500/20 to-gray-700/20 border-gray-500/30';
        const icon = languageIcons[lang.id] || '📄';

        return (
          <button
            key={lang.id}
            onClick={() => onToggleLanguage(lang.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 border
              ${isSelected
                ? `bg-gradient-to-r ${colors} text-white shadow-lg`
                : 'bg-white/5 border-white/10 text-ide-text-muted hover:bg-white/8 hover:border-white/15'
              }
            `}
          >
            <span className="text-base">{icon}</span>
            <span>{lang.name}</span>
            {isSelected && mode === 'multi' && (
              <span className="ml-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
