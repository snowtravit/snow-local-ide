import Dockerode from 'dockerode';
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
const runningContainers = new Map<string, Dockerode.Container>();

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
    const containerName = `ide-exec-${containerId}`;
    const startTime = Date.now();

    let container: Dockerode.Container | null = null;

    try {
      // Prepare the code as a tar archive for copying into container
      const codeFiles = files.map((f) => ({
        name: f.name,
        content: f.content,
      }));

      // Build the execution command
      let cmd: string[];
      if (language.compileCommand) {
        cmd = [
          'sh',
          '-c',
          `${language.compileCommand} 2>&1 && ${language.command} 2>&1`,
        ];
      } else {
        cmd = ['sh', '-c', `${language.command} 2>&1`];
      }

      // Create container with resource limits
      container = await docker.createContainer({
        Image: language.image,
        name: containerName,
        Cmd: cmd,
        WorkingDir: '/code',
        HostConfig: {
          Memory: parseInt(language.memoryLimit) * 1024 * 1024,
          NanoCpus: parseFloat(language.cpuLimit) * 1e9,
          NetworkMode: 'none',
          AutoRemove: false,
          PidsLimit: 100,
          ReadonlyRootfs: false,
        },
        Tty: false,
        OpenStdin: !!stdin,
        StdinOnce: !!stdin,
        AttachStdin: !!stdin,
        AttachStdout: true,
        AttachStderr: true,
      });

      // Write files into the container
      const tarStream = await createTarArchive(codeFiles);
      await container.putArchive(tarStream, { path: '/code' });

      // Track the container
      runningContainers.set(containerId, container);

      // Start with timeout
      const timeoutPromise = new Promise<ExecutionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            output: `Execution timed out after ${language.timeout / 1000} seconds`,
            exitCode: 124,
            executionTime: language.timeout,
            status: 'timeout',
          });
        }, language.timeout);
      });

      const executionPromise = (async (): Promise<ExecutionResult> => {
        // If stdin is provided, attach to container and write stdin
        if (stdin) {
          const attachStream = await container!.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true,
          });
          await container!.start();
          attachStream.write(stdin);
          if (!stdin.endsWith('\n')) {
            attachStream.write('\n');
          }
          attachStream.end();
        } else {
          await container!.start();
        }

        const result = await container!.wait();
        const logs = await container!.logs({
          stdout: true,
          stderr: true,
          follow: false,
        });

        const output = demuxDockerStream(logs);
        const executionTime = Date.now() - startTime;

        return {
          output: output.trim(),
          exitCode: result.StatusCode,
          executionTime,
          status: result.StatusCode === 0 ? 'success' : 'error',
        };
      })();

      const result = await Promise.race([executionPromise, timeoutPromise]);

      return result;
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        output: `Execution error: ${errorMessage}`,
        exitCode: 1,
        executionTime,
        status: 'error',
      };
    } finally {
      runningContainers.delete(containerId);
      if (container) {
        try {
          await container.stop({ t: 0 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        } catch {
          // Container already removed or doesn't exist
        }
      }
    }
  }

  /**
   * Stop a running execution
   */
  static async stopExecution(executionId: string): Promise<boolean> {
    const container = runningContainers.get(executionId);
    if (container) {
      try {
        await container.stop({ t: 0 });
        await container.remove({ force: true });
        runningContainers.delete(executionId);
        return true;
      } catch {
        return false;
      }
    }
    return false;
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

  for (const file of files) {
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

function createTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);

  // File name (0-99)
  header.write(name, 0, Math.min(name.length, 100), 'utf-8');

  // File mode (100-107)
  header.write('0000777\0', 100, 8, 'utf-8');

  // Owner ID (108-115)
  header.write('0000000\0', 108, 8, 'utf-8');

  // Group ID (116-123)
  header.write('0000000\0', 116, 8, 'utf-8');

  // File size in octal (124-135)
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf-8');

  // Modification time (136-147)
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 12, 'utf-8');

  // Type flag - regular file (156)
  header.write('0', 156, 1, 'utf-8');

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

/**
 * Demux Docker stream (separate stdout/stderr)
 */
function demuxDockerStream(buffer: Buffer): string {
  const output: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      // Not enough data for header, treat rest as raw output
      output.push(buffer.slice(offset).toString('utf-8'));
      break;
    }

    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) {
      output.push(buffer.slice(offset).toString('utf-8'));
      break;
    }

    output.push(buffer.slice(offset, offset + size).toString('utf-8'));
    offset += size;
  }

  return output.join('');
}
