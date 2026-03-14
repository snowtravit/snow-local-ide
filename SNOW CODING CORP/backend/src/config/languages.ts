export interface LanguageConfig {
  id: string;
  name: string;
  extension: string;
  image: string;
  command: string;
  compileCommand?: string;
  monacoLanguage: string;
  defaultCode: string;
  timeout: number;
  memoryLimit: string;
  cpuLimit: string;
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: 'python',
    name: 'Python',
    extension: '.py',
    image: 'snow-ide-python',
    command: 'python3 /code/main.py',
    monacoLanguage: 'python',
    defaultCode: `# Python 3\nprint("Hello, World!")`,
    timeout: 30000,
    memoryLimit: '256m',
    cpuLimit: '0.5',
  },
  java: {
    id: 'java',
    name: 'Java',
    extension: '.java',
    image: 'snow-ide-java',
    compileCommand: 'javac /code/Main.java',
    command: 'java -cp /code Main',
    monacoLanguage: 'java',
    defaultCode: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    timeout: 30000,
    memoryLimit: '512m',
    cpuLimit: '0.5',
  },
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    extension: '.js',
    image: 'snow-ide-javascript',
    command: 'node /code/main.js',
    monacoLanguage: 'javascript',
    defaultCode: `// JavaScript (Node.js)\nconsole.log("Hello, World!");`,
    timeout: 30000,
    memoryLimit: '256m',
    cpuLimit: '0.5',
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    extension: '.cpp',
    image: 'snow-ide-cpp',
    compileCommand: 'g++ -o /code/main /code/main.cpp -std=c++17',
    command: '/code/main',
    monacoLanguage: 'cpp',
    defaultCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    timeout: 30000,
    memoryLimit: '256m',
    cpuLimit: '0.5',
  },
  csharp: {
    id: 'csharp',
    name: 'C#',
    extension: '.cs',
    image: 'snow-ide-csharp',
    command: 'dotnet script /code/main.cs',
    monacoLanguage: 'csharp',
    defaultCode: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}`,
    timeout: 30000,
    memoryLimit: '512m',
    cpuLimit: '0.5',
  },
  go: {
    id: 'go',
    name: 'Go',
    extension: '.go',
    image: 'snow-ide-go',
    command: 'go run /code/main.go',
    monacoLanguage: 'go',
    defaultCode: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    timeout: 30000,
    memoryLimit: '256m',
    cpuLimit: '0.5',
  },
  php: {
    id: 'php',
    name: 'PHP',
    extension: '.php',
    image: 'snow-ide-php',
    command: 'php /code/main.php',
    monacoLanguage: 'php',
    defaultCode: `<?php\necho "Hello, World!\\n";\n?>`,
    timeout: 30000,
    memoryLimit: '256m',
    cpuLimit: '0.5',
  },
  html: {
    id: 'html',
    name: 'HTML',
    extension: '.html',
    image: 'snow-ide-html',
    command: 'cat /code/index.html',
    monacoLanguage: 'html',
    defaultCode: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Hello</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>`,
    timeout: 10000,
    memoryLimit: '128m',
    cpuLimit: '0.25',
  },
};

export function getLanguageById(id: string): LanguageConfig | undefined {
  return LANGUAGES[id];
}

export function getAllLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGES);
}
