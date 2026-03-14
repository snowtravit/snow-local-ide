import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  onSave,
}) => {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define SNOW theme
    monaco.editor.defineTheme('snow', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C0C0C0' },
        { token: 'string', foreground: 'A5D6FF' },
        { token: 'number', foreground: 'B0C4DE' },
        { token: 'type', foreground: 'D4D4D4' },
        { token: 'function', foreground: 'E0E0E0' },
        { token: 'variable', foreground: 'F0F0F0' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#E8E8E8',
        'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#C0C0C040',
        'editorCursor.foreground': '#FFFFFF',
        'editorLineNumber.foreground': '#ffffff30',
        'editorLineNumber.activeForeground': '#ffffff60',
      },
    });

    monaco.editor.setTheme('snow');

    // Add Ctrl+S save handler
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Set editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      minimap: { enabled: true, maxColumn: 80 },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 16 },
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
      },
    });
  };

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        theme="vs-dark"
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorMount}
        options={{
          automaticLayout: true,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full text-ide-text-muted">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-snow-accent/30 border-t-snow-accent rounded-full animate-spin" />
              <span className="text-sm">Loading editor...</span>
            </div>
          </div>
        }
      />
    </div>
  );
};
