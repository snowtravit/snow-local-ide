import Dockerode from 'dockerode';
import { Duplex, Writable } from 'stream';
import { StringDecoder } from 'string_decoder';
import { v4 as uuidv4 } from 'uuid';
import { LanguageConfig } from '../config/languages';

const docker = new Dockerode({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
});

interface ExecutionResult {
  output: string;
  exitCode: number;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
}

// Track running containers for stop functionality
const runningContainers = new Map<string, { container: Dockerode.Container | null; stopped: boolean }>();
const OUTPUT_LIMIT = 100 * 1024;

export class DockerService {
  /**
   * Execute code in an isolated Docker container
   */
  static async executeCode(
    language: LanguageConfig,
    files: Array<{ name: string; content: string }>,
    executionId?: string,
    stdin?: string
  ): Promise<ExecutionResult> {
    const containerId = executionId || uuidv4();
    const startTime = Date.now();
    if (runningContainers.has(containerId)) {
      return { output: 'Execution ID is already running', exitCode: 1, executionTime: 0, status: 'error' };
    }
    const execution = { container: null as Dockerode.Container | null, stopped: false };
    runningContainers.set(containerId, execution);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inputStream: Duplex | undefined;
    let output = '';
    let outputBytes = 0;
    let outputLimited = false;
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    const createCapture = (decoder: StringDecoder) => new Writable({
      write(chunk: Buffer, _encoding, done) {
        const remaining = OUTPUT_LIMIT - outputBytes;
        if (remaining > 0) {
          const accepted = chunk.subarray(0, remaining);
          output += decoder.write(accepted);
          outputBytes += accepted.length;
        }
        if (chunk.length > remaining && !outputLimited) {
          outputLimited = true;
          void execution.container?.stop({ t: 0 }).catch(() => {});
        }
        done();
      },
    });
    const stdoutCapture = createCapture(stdoutDecoder);
    const stderrCapture = createCapture(stderrDecoder);
    const getOutput = () => output.trim();

    try {
      // Also validate here so direct callers cannot create unsafe archive entries.
      if (files.length === 0 || files.some((file) =>
        typeof file.name !== 'string' || typeof file.content !== 'string' ||
        !/^[\p{L}\p{N}_ ./-]+$/u.test(file.name) || file.name.startsWith('/') ||
        file.name.split('/').some((part) => !part || part === '.' || part === '..') ||
        Buffer.byteLength(file.name, 'utf8') > 100)) {
        throw new Error('Files must use safe relative names up to 100 UTF-8 bytes');
      }
      const codeFiles = [...files];
      let runCommand = language.command;
      let compileCommand = language.compileCommand;
      // Run the active file even after it was renamed in the editor.
      // Validation excludes quotes; quote spaces and preserve its import directory.
      const entryPath = `'/code/${files[0].name}'`;
      switch (language.id) {
        case 'python': runCommand = `python3 -u ${entryPath}`; break;
        case 'javascript': runCommand = `node ${entryPath}`; break;
        case 'go': runCommand = `go run ${entryPath}`; break;
        case 'php': runCommand = `php ${entryPath}`; break;
        case 'html': runCommand = `cat ${entryPath}`; break;
        case 'cpp': compileCommand = `g++ -o /code/main ${entryPath} -std=c++17`; break;
      }
      if (language.id === 'java') {
        const className = files[0].content.match(/public\s+class\s+([A-Za-z_$][\w$]*)/)?.[1] || 'Main';
        const packageName = files[0].content.match(/^\s*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/m)?.[1];
        const entryName = `${className}.java`;
        compileCommand = `javac -d /code '/code/${entryName}'`;
        runCommand = `java -cp /code '${packageName ? `${packageName}.` : ''}${className}'`;
        if (files[0].name !== entryName) {
          const existingEntry = codeFiles.findIndex((file) => file.name === entryName);
          const entryFile = { name: entryName, content: files[0].content };
          if (existingEntry >= 0) codeFiles[existingEntry] = entryFile;
          else codeFiles.push(entryFile);
        }
      }
      const command = compileCommand
        ? `${compileCommand} && ${runCommand}`
        : runCommand;
      execution.container = await docker.createContainer({
        Image: language.image,
        name: `ide-exec-${containerId}`,
        Cmd: ['sh', '-c', command],
        WorkingDir: '/code',
        HostConfig: {
          Memory: parseInt(language.memoryLimit) * 1024 * 1024,
          NanoCpus: parseFloat(language.cpuLimit) * 1e9,
          NetworkMode: 'none',
          AutoRemove: false,
          PidsLimit: 100,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          LogConfig: { Type: 'json-file', Config: { 'max-size': '1m', 'max-file': '1' } },
        },
        Tty: false,
        // Attach even for an empty input so programs reading stdin receive EOF.
        OpenStdin: true,
        StdinOnce: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
      });
      const container = execution.container;
      if (execution.stopped) {
        return { output: 'Execution stopped', exitCode: 137, executionTime: Date.now() - startTime, status: 'error' };
      }
      await container.putArchive(await createTarArchive(codeFiles), { path: '/code' });
      inputStream = await container.attach({
        stream: true, stdin: true, stdout: true, stderr: true, hijack: true,
      }) as Duplex;
      inputStream.on('error', () => {});

      const timeoutPromise = new Promise<ExecutionResult>((resolve) => {
        timer = setTimeout(() => {
          const message = `Execution timed out after ${language.timeout / 1000} seconds`;
          resolve({
            output: getOutput() ? `${getOutput()}\n\n${message}` : message,
            exitCode: 124, executionTime: Date.now() - startTime, status: 'timeout',
          });
        }, language.timeout);
        timer.unref();
      });
      const executionPromise = (async (): Promise<ExecutionResult> => {
        if (execution.stopped) {
          return { output: 'Execution stopped', exitCode: 137, executionTime: Date.now() - startTime, status: 'error' };
        }
        // Capture raw attached streams before starting the program. Docker's log
        // reader buffers incomplete lines, delaying output and partial timeout text.
        const outputCompletion = new Promise<void>((resolve, reject) => {
          inputStream!.once('end', resolve);
          inputStream!.once('error', reject);
          inputStream!.once('close', () => {
            if (inputStream!.readableEnded) resolve();
            else reject(new Error('Docker output connection closed before EOF'));
          });
          docker.modem.demuxStream(inputStream!, stdoutCapture, stderrCapture);
        });
        // A disconnect can arrive while start() is still pending.
        void outputCompletion.catch(() => {});
        await container.start();
        // Stop may have arrived while Docker was still completing start().
        if (execution.stopped) {
          await container.stop({ t: 0 }).catch(() => {});
          return { output: 'Execution stopped', exitCode: 137, executionTime: Date.now() - startTime, status: 'error' };
        }
        inputStream!.end(stdin ? (stdin.endsWith('\n') ? stdin : `${stdin}\n`) : '');
        const [result] = await Promise.all([container.wait(), outputCompletion]);
        if (!outputLimited) output += stdoutDecoder.end() + stderrDecoder.end();
        const suffix = outputLimited ? '\n[Output exceeded 100 KiB; execution stopped]' : '';
        return {
          output: `${getOutput()}${suffix}`.trim(),
          exitCode: outputLimited ? 1 : result.StatusCode,
          executionTime: Date.now() - startTime,
          status: !outputLimited && result.StatusCode === 0 ? 'success' : 'error',
        };
      })();
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Execution error: ${message}`, exitCode: 1, executionTime: Date.now() - startTime, status: 'error' };
    } finally {
      if (timer) clearTimeout(timer);
      const container = execution.container;
      if (container) {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
      }
      inputStream?.destroy();
      stdoutCapture.destroy();
      stderrCapture.destroy();
      runningContainers.delete(containerId);
    }
  }

  /** Stop the process; executeCode owns log collection and final cleanup. */
  static async stopExecution(executionId: string): Promise<boolean> {
    const execution = runningContainers.get(executionId);
    if (!execution) return false;
    execution.stopped = true;
    if (execution.container) {
      await execution.container.stop({ t: 0 }).catch(() => {});
    }
    return true;
  }

  /**
   * Check if Docker is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build all language images
   */
  static async buildImages(
    dockerDir: string
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const fs = await import('fs');
    const path = await import('path');

    const dirs = fs.readdirSync(path.join(dockerDir, 'images'));
    for (const dir of dirs) {
      const dockerfilePath = path.join(dockerDir, 'images', dir);
      if (
        fs.existsSync(path.join(dockerfilePath, 'Dockerfile'))
      ) {
        try {
          console.log(`[Docker] Building image: snow-ide-${dir}`);
          const stream = await docker.buildImage(
            {
              context: dockerfilePath,
              src: ['Dockerfile'],
            },
            { t: `snow-ide-${dir}` }
          );

          await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(
              stream,
              (err: Error | null) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          results.set(dir, true);
          console.log(`[Docker] Built: snow-ide-${dir}`);
        } catch (error) {
          console.error(`[Docker] Failed to build ${dir}:`, error);
          results.set(dir, false);
        }
      }
    }

    return results;
  }
}

/**
 * Create a tar archive from code files
 */
async function createTarArchive(
  files: Array<{ name: string; content: string }>
): Promise<Buffer> {
  // Simple tar implementation for small files
  const chunks: Buffer[] = [];
  const directories = new Set<string>();

  for (const file of files) {
    const parts = file.name.split('/');
    for (let count = 1; count < parts.length; count++) {
      const directory = `${parts.slice(0, count).join('/')}/`;
      if (!directories.has(directory)) {
        chunks.push(createTarHeader(directory, 0, '5'));
        directories.add(directory);
      }
    }
    const content = Buffer.from(file.content, 'utf-8');
    const header = createTarHeader(file.name, content.length);
    chunks.push(header);
    chunks.push(content);

    // Pad to 512-byte boundary
    const padding = 512 - (content.length % 512);
    if (padding < 512) {
      chunks.push(Buffer.alloc(padding, 0));
    }
  }

  // End-of-archive marker
  chunks.push(Buffer.alloc(1024, 0));

  return Buffer.concat(chunks);
}

function createTarHeader(name: string, size: number, type = '0'): Buffer {
  const header = Buffer.alloc(512, 0);

  // File name (0-99)
  header.write(name, 0, Math.min(Buffer.byteLength(name, 'utf-8'), 100), 'utf-8');

  // File mode (100-107)
  header.write(type === '5' ? '0000755\0' : '0000644\0', 100, 8, 'utf-8');

  // Owner ID (108-115)
  header.write('0177776\0', 108, 8, 'utf-8');

  // Group ID (116-123)
  header.write('0177776\0', 116, 8, 'utf-8');

  // File size in octal (124-135)
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf-8');

  // Modification time (136-147)
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 12, 'utf-8');

  // Type flag - regular file (156)
  header.write(type, 156, 1, 'utf-8');

  // Checksum placeholder (148-155)
  header.write('        ', 148, 8, 'utf-8');

  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf-8');

  return header;
}
