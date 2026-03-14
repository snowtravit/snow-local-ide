import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LanguageConfig } from '../config/languages';

/**
 * Process raw stdout to handle ANSI clear-screen sequences.
 * When code calls console.clear() (or equivalent), it emits ANSI escape
 * codes like \x1Bc, \x1B[2J, \x1B[3J.  In a real terminal these clear
 * the screen, but we capture stdout as a string so they appear as garbage.
 *
 * Strategy: split on clear-screen sequences and keep only the text after
 * the LAST clear, then strip any remaining ANSI escape codes.
 */
function processAnsiOutput(raw: string): string {
  // Common clear-screen sequences:
  //   \x1Bc        — Full terminal reset (Node console.clear on some platforms)
  //   \x1B[2J      — Erase entire screen
  //   \x1B[3J      — Erase scrollback buffer
  //   \x1B[H       — Cursor home (often paired with [2J)
  const clearPattern = /\x1Bc|\x1B\[2J|\x1B\[3J/g;
  let lastClearEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = clearPattern.exec(raw)) !== null) {
    lastClearEnd = m.index + m[0].length;
  }
  let result = lastClearEnd > 0 ? raw.slice(lastClearEnd) : raw;

  // Strip cursor-positioning sequences (e.g. \x1B[H) that follow clear
  result = result.replace(/\x1B\[\d*;?\d*[Hf]/g, '');

  // Strip any remaining ANSI escape sequences (colors, cursor moves, etc.)
  // so the output is clean plain text for the <pre> tag in the frontend.
  result = result.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  result = result.replace(/\x1B\][^\x07]*\x07/g, '');   // OSC sequences
  result = result.replace(/\x1B[()][0-9A-B]/g, '');       // Character set

  return result;
}

interface ExecutionResult {
  output: string;
  exitCode: number;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
}

/**
 * Map language IDs to local runtime detection.
 * Each entry has:
 *   - commands: possible executable names to check (in order)
 *   - getRunCmd: given the found executable and temp dir, return the shell command to run
 *   - getCompileCmd: optional compilation step
 *   - fileName: the filename to write the code into
 */
interface LocalRuntime {
  commands: string[];
  fileName: string;
  getCompileCmd?: (exe: string, tempDir: string, fileName: string) => string;
  getRunCmd: (exe: string, tempDir: string, fileName: string) => string;
}

/** Project root directory (where runtimes/ folder lives) */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNTIMES_DIR = path.join(PROJECT_ROOT, 'runtimes');

/**
 * Portable runtime info: bin directory to add to PATH,
 * the executable to check, and optional extra env vars.
 */
interface PortableRuntimeInfo {
  binDir: string;
  exe: string;
  extraEnv?: Record<string, string>;
}

/**
 * Returns possible portable runtime paths for a language.
 * Checks the runtimes/ directory at the project root.
 */
function getPortableRuntimePaths(language: string): PortableRuntimeInfo[] {
  const isWindows = process.platform === 'win32';
  const ext = isWindows ? '.exe' : '';
  const results: PortableRuntimeInfo[] = [];

  switch (language) {
    case 'javascript': {
      const nodeDir = path.join(PROJECT_ROOT, 'node');
      if (isWindows) {
        results.push({ binDir: nodeDir, exe: path.join(nodeDir, 'node.exe') });
      } else {
        const binDir = path.join(nodeDir, 'bin');
        results.push({ binDir, exe: path.join(binDir, 'node') });
      }
      break;
    }
    case 'python': {
      const pyDir = path.join(RUNTIMES_DIR, 'python');
      if (isWindows) {
        results.push({ binDir: pyDir, exe: path.join(pyDir, 'python.exe') });
      } else {
        const binDir = path.join(pyDir, 'bin');
        results.push({ binDir, exe: path.join(binDir, 'python3') });
        results.push({ binDir, exe: path.join(binDir, 'python') });
      }
      break;
    }
    case 'go': {
      const goRoot = path.join(RUNTIMES_DIR, 'go');
      const binDir = path.join(goRoot, 'bin');
      results.push({
        binDir,
        exe: path.join(binDir, `go${ext}`),
        extraEnv: {
          GOROOT: goRoot,
          GOPATH: path.join(RUNTIMES_DIR, 'go', 'gopath'),
          GOCACHE: path.join(RUNTIMES_DIR, 'go', 'cache'),
          GO111MODULE: 'off',
        },
      });
      break;
    }
    case 'java': {
      const javaHome = path.join(RUNTIMES_DIR, 'java');
      const binDir = path.join(javaHome, 'bin');
      results.push({
        binDir,
        exe: path.join(binDir, `javac${ext}`),
        extraEnv: { JAVA_HOME: javaHome },
      });
      break;
    }
    case 'cpp': {
      if (isWindows) {
        const mingwDir = path.join(RUNTIMES_DIR, 'mingw');
        const binDir = path.join(mingwDir, 'bin');
        results.push({ binDir, exe: path.join(binDir, 'g++.exe') });
      }
      // On Linux/macOS, g++ is expected to be system-installed
      break;
    }
    case 'php': {
      const phpDir = path.join(RUNTIMES_DIR, 'php');
      if (isWindows) {
        results.push({ binDir: phpDir, exe: path.join(phpDir, 'php.exe') });
      } else {
        const binDir = path.join(phpDir, 'bin');
        results.push({ binDir, exe: path.join(binDir, 'php') });
        results.push({ binDir: phpDir, exe: path.join(phpDir, 'php') });
      }
      break;
    }
    case 'csharp': {
      const dotnetDir = path.join(RUNTIMES_DIR, 'dotnet');
      results.push({
        binDir: dotnetDir,
        exe: path.join(dotnetDir, `dotnet${ext}`),
        extraEnv: {
          DOTNET_ROOT: dotnetDir,
          DOTNET_CLI_HOME: dotnetDir,
          DOTNET_CLI_TELEMETRY_OPTOUT: '1',
          DOTNET_NOLOGO: '1',
        },
      });
      break;
    }
  }

  return results;
}

/**
 * Extract the public class name from Java source code.
 * Falls back to 'Main' if no public class is found.
 */
function extractJavaClassName(code: string): string {
  const match = code.match(/public\s+class\s+(\w+)/);
  return match ? match[1] : 'Main';
}

const LOCAL_RUNTIMES: Record<string, LocalRuntime> = {
  javascript: {
    commands: ['node'],
    fileName: 'main.js',
    getRunCmd: (exe, tempDir, fileName) => {
      // Use --require to load a preload script that makes console.clear()
      // emit ANSI clear-screen sequences even when stdout is piped.
      const preload = path.join(tempDir, '__preload.js');
      return `"${exe}" --require "${preload}" "${path.join(tempDir, fileName)}"`;
    },
  },
  python: {
    commands: ['python3', 'python'],
    fileName: 'main.py',
    getRunCmd: (exe, tempDir, fileName) => {
      // Run through a wrapper that patches os.system('cls'/'clear')
      // to emit ANSI sequences so screen-clearing works in piped mode.
      const runner = path.join(tempDir, '__runner.py');
      return `"${exe}" "${runner}" "${path.join(tempDir, fileName)}"`;
    },
  },
  php: {
    commands: ['php'],
    fileName: 'main.php',
    getRunCmd: (exe, tempDir, fileName) => `"${exe}" "${path.join(tempDir, fileName)}"`,
  },
  go: {
    commands: ['go'],
    fileName: 'main.go',
    getRunCmd: (exe, tempDir, fileName) => `"${exe}" run "${path.join(tempDir, fileName)}"`,
  },
  cpp: {
    commands: ['g++'],
    fileName: 'main.cpp',
    getCompileCmd: (exe, tempDir, fileName) => {
      const outName = process.platform === 'win32' ? 'main.exe' : 'main';
      return `"${exe}" -o "${path.join(tempDir, outName)}" "${path.join(tempDir, fileName)}" -std=c++17`;
    },
    getRunCmd: (_exe, tempDir) => {
      const outName = process.platform === 'win32' ? 'main.exe' : 'main';
      return `"${path.join(tempDir, outName)}"`;
    },
  },
  java: {
    commands: ['javac'],
    fileName: 'Main.java',
    getCompileCmd: (exe, tempDir, fileName) => `"${exe}" "${path.join(tempDir, fileName)}"`,
    getRunCmd: (_exe, tempDir, fileName) => {
      // Derive the class name from the actual .java file name
      const className = fileName.replace(/\.java$/i, '');
      return `java -cp "${tempDir}" ${className}`;
    },
  },
  csharp: {
    commands: ['dotnet'],
    fileName: 'Program.cs',
    getRunCmd: (exe, tempDir) => `"${exe}" run --project "${tempDir}" --nologo`,
  },
};

/**
 * Check if a command exists on the system
 */
function commandExists(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows
      ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe')
      : 'which';
    execFile(checkCmd, [cmd], (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim().split('\n')[0].trim());
      }
    });
  });
}

interface RuntimeResult {
  exe: string;
  runtime: LocalRuntime;
  extraPath?: string;
  extraEnv?: Record<string, string>;
}

/**
 * Find available runtime for a language.
 * Priority: portable runtime (runtimes/) > system PATH.
 */
async function findRuntime(language: string): Promise<RuntimeResult | null> {
  const runtime = LOCAL_RUNTIMES[language];
  if (!runtime) return null;

  // 1. Check portable runtimes in runtimes/ directory
  const portablePaths = getPortableRuntimePaths(language);
  for (const portable of portablePaths) {
    try {
      if (fs.existsSync(portable.exe)) {
        return {
          exe: portable.exe,
          runtime,
          extraPath: portable.binDir,
          extraEnv: portable.extraEnv,
        };
      }
    } catch {
      // Ignore errors checking portable paths
    }
  }

  // 2. Fall back to system PATH
  for (const cmd of runtime.commands) {
    const exePath = await commandExists(cmd);
    if (exePath) {
      return { exe: cmd, runtime };
    }
  }
  return null;
}

/**
 * Run a shell command with timeout, optional stdin, and optional extra PATH/env
 */
function runCommand(
  command: string,
  options: {
    timeout: number;
    cwd: string;
    stdin?: string;
    extraPath?: string;
    extraEnv?: Record<string, string>;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows
      ? (process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'))
      : '/bin/sh';
    const shellArg = isWindows ? '/c' : '-c';

    const env: Record<string, string | undefined> = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
    };

    // Add extra PATH for portable runtimes
    if (options.extraPath) {
      const pathSep = isWindows ? ';' : ':';
      env.PATH = options.extraPath + pathSep + (env.PATH || '');
    }

    // Add extra environment variables for portable runtimes
    if (options.extraEnv) {
      for (const [key, value] of Object.entries(options.extraEnv)) {
        env[key] = value;
      }
    }

    // On Windows, cmd.exe /c strips the first and last quote from the
    // command string when both exist, which breaks paths containing
    // spaces or parentheses.  Wrapping in an extra pair of quotes
    // (cmd /c "\"exe\" args") prevents the stripping.
    const shellCommand = isWindows ? `"${command}"` : command;

    const proc = spawn(shell, [shellArg, shellCommand], {
      cwd: options.cwd,
      timeout: options.timeout,
      env,
      // On Windows, prevent Node.js from escaping quotes with backslashes
      // when building the command line for CreateProcessW.  Without this,
      // cmd.exe receives literal \" sequences and fails to parse the command.
      windowsVerbatimArguments: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
      // Limit output size to 100KB
      if (stdout.length > 102400) {
        proc.kill('SIGTERM');
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
      if (stderr.length > 102400) {
        proc.kill('SIGTERM');
      }
    });

    if (options.stdin) {
      proc.stdin.write(options.stdin);
      if (!options.stdin.endsWith('\n')) {
        proc.stdin.write('\n');
      }
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    proc.on('error', (err) => {
      resolve({
        stdout,
        stderr: stderr || err.message,
        exitCode: 1,
        timedOut: false,
      });
    });

    proc.on('close', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        timedOut = true;
      }
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        timedOut,
      });
    });
  });
}

export class LocalExecutionService {
  /**
   * Execute code locally using available system or portable runtimes.
   * Returns null if no suitable runtime is found (caller should handle fallback).
   */
  static async executeCode(
    language: LanguageConfig,
    files: Array<{ name: string; content: string }>,
    stdin?: string
  ): Promise<ExecutionResult | null> {
    // Special case: HTML just returns the code (it's markup, not executable)
    if (language.id === 'html') {
      return {
        output: files[0]?.content || '[No HTML content]',
        exitCode: 0,
        executionTime: 0,
        status: 'success',
      };
    }

    const runtimeInfo = await findRuntime(language.id);
    if (!runtimeInfo) {
      return null; // No local runtime available
    }

    const { exe, runtime, extraPath, extraEnv } = runtimeInfo;
    const startTime = Date.now();

    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-ide-'));

    try {
      // Write all files to temp directory
      for (const file of files) {
        const filePath = path.join(tempDir, file.name);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }

      // Determine the actual file name to compile/run.
      // For Java, the file name must match the public class name.
      let actualFileName = runtime.fileName;
      const mainFile = files[0];

      if (language.id === 'java' && mainFile) {
        const className = extractJavaClassName(mainFile.content);
        actualFileName = `${className}.java`;
        // Write the code under the correct file name if it differs
        if (actualFileName !== mainFile.name) {
          fs.writeFileSync(path.join(tempDir, actualFileName), mainFile.content, 'utf-8');
        }
      } else if (mainFile && mainFile.name !== runtime.fileName) {
        // For other languages, copy as the default file name if needed
        fs.writeFileSync(path.join(tempDir, runtime.fileName), mainFile.content, 'utf-8');
      }

      // For JavaScript: create a preload script that overrides console.clear()
      // so it emits ANSI escape codes even when stdout is piped (not a TTY).
      if (language.id === 'javascript') {
        const preloadCode = [
          '// Snow IDE: make console.clear() work in captured output',
          'if (!process.stdout.isTTY) {',
          '  const origClear = console.clear;',
          '  console.clear = function() {',
          "    process.stdout.write('\\x1Bc');",
          '  };',
          '}',
        ].join('\n');
        fs.writeFileSync(path.join(tempDir, '__preload.js'), preloadCode, 'utf-8');
      }

      // For Python: create a runner script that patches os.system('cls'/'clear')
      // to emit ANSI clear-screen sequences instead of running a subprocess
      // (which does nothing useful when stdout is captured).
      if (language.id === 'python') {
        const runnerCode = [
          'import sys, os',
          '_orig_system = os.system',
          'def _patched_system(cmd):',
          "    if cmd.strip().lower() in ('cls', 'clear'):",
          "        sys.stdout.write('\\033[2J\\033[H')",
          '        sys.stdout.flush()',
          '        return 0',
          '    return _orig_system(cmd)',
          'os.system = _patched_system',
          '_target = sys.argv[1]',
          'sys.argv = sys.argv[1:]',
          "_code = open(_target, 'r', encoding='utf-8').read()",
          "exec(compile(_code, _target, 'exec'), {'__name__': '__main__', '__file__': _target, '__builtins__': __builtins__})",
        ].join('\n');
        fs.writeFileSync(path.join(tempDir, '__runner.py'), runnerCode, 'utf-8');
      }

      // For C#, create a minimal project file so dotnet run works
      if (language.id === 'csharp') {
        const csprojContent = [
          '<Project Sdk="Microsoft.NET.Sdk">',
          '  <PropertyGroup>',
          '    <OutputType>Exe</OutputType>',
          '    <TargetFramework>net8.0</TargetFramework>',
          '    <ImplicitUsings>enable</ImplicitUsings>',
          '  </PropertyGroup>',
          '</Project>',
        ].join('\n');
        fs.writeFileSync(path.join(tempDir, 'app.csproj'), csprojContent, 'utf-8');
      }

      // Ensure Go working directories exist for portable runtime
      if (language.id === 'go' && extraEnv) {
        if (extraEnv.GOPATH) {
          fs.mkdirSync(extraEnv.GOPATH, { recursive: true });
        }
        if (extraEnv.GOCACHE) {
          fs.mkdirSync(extraEnv.GOCACHE, { recursive: true });
        }
      }

      // Compile step (if needed)
      if (runtime.getCompileCmd) {
        const compileCmd = runtime.getCompileCmd(exe, tempDir, actualFileName);
        const compileResult = await runCommand(compileCmd, {
          timeout: language.timeout,
          cwd: tempDir,
          extraPath,
          extraEnv,
        });

        if (compileResult.exitCode !== 0) {
          return {
            output: (compileResult.stderr || compileResult.stdout || 'Compilation failed').trim(),
            exitCode: compileResult.exitCode,
            executionTime: Date.now() - startTime,
            status: 'error',
          };
        }
      }

      // Run step
      const runCmd = runtime.getRunCmd(exe, tempDir, actualFileName);
      const result = await runCommand(runCmd, {
        timeout: language.timeout,
        cwd: tempDir,
        stdin,
        extraPath,
        extraEnv,
      });

      const executionTime = Date.now() - startTime;

      const rawOutput = (result.stdout + (result.stderr ? '\n' + result.stderr : '')).trim();
      const output = processAnsiOutput(rawOutput);

      if (result.timedOut) {
        // Include any captured output so the user can see what happened
        // before the timeout (e.g. animation frames, partial results).
        const timedOutMsg = `[Execution timed out after ${language.timeout / 1000} seconds]`;
        return {
          output: output ? `${output}\n\n${timedOutMsg}` : timedOutMsg,
          exitCode: 124,
          executionTime,
          status: 'timeout',
        };
      }

      return {
        output: output || '[No output]',
        exitCode: result.exitCode,
        executionTime,
        status: result.exitCode === 0 ? 'success' : 'error',
      };
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: `Execution error: ${errorMessage}`,
        exitCode: 1,
        executionTime,
        status: 'error',
      };
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Check which languages have local runtimes available
   */
  static async getAvailableRuntimes(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const langId of Object.keys(LOCAL_RUNTIMES)) {
      const runtime = await findRuntime(langId);
      results[langId] = runtime !== null;
    }
    // HTML is always available (it's markup, not executed)
    results['html'] = true;
    return results;
  }
}
