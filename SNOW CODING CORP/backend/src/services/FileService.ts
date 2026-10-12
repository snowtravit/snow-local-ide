import * as fs from 'fs';
import * as path from 'path';
import { validate as isUuid } from 'uuid';
import { randomUUID } from 'crypto';

const PROJECTS_DIR = path.resolve(process.env.PROJECTS_DIR || path.join(__dirname, '../../projects'));

export class FileValidationError extends Error {}

export class FileService {
  static init(): void {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }

  static validateRelativePath(filePath: unknown): asserts filePath is string {
    if (typeof filePath !== 'string' || !/^[\p{L}\p{N}_ ./-]+$/u.test(filePath) ||
      filePath.startsWith('/') || Buffer.byteLength(filePath, 'utf8') > 100 ||
      filePath.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new FileValidationError('Use a safe relative file path up to 100 UTF-8 bytes');
    }
  }

  static getProjectPath(projectId: string): string {
    if (typeof projectId !== 'string' || !isUuid(projectId)) {
      throw new FileValidationError('Invalid project ID');
    }
    const projectPath = path.join(PROJECTS_DIR, projectId);
    if (fs.existsSync(projectPath) && fs.lstatSync(projectPath).isSymbolicLink()) {
      throw new FileValidationError('Symbolic links are not allowed in project paths');
    }
    return projectPath;
  }

  private static resolveFile(projectId: string, filePath: string, allowRoot = false): string {
    const projectPath = this.getProjectPath(projectId);
    if (!allowRoot || filePath !== '') this.validateRelativePath(filePath);
    const fullPath = path.join(projectPath, filePath);
    let current = projectPath;
    for (const part of filePath.split('/').filter(Boolean)) {
      current = path.join(current, part);
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
        throw new FileValidationError('Symbolic links are not allowed in project paths');
      }
    }
    return fullPath;
  }

  static createProjectDir(projectId: string): string {
    const projectPath = this.getProjectPath(projectId);
    fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
  }

  static writeFile(projectId: string, filePath: string, content: string): void {
    if (typeof content !== 'string') throw new FileValidationError('File content must be a string');
    const fullPath = this.resolveFile(projectId, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    const temporaryPath = path.join(dir, `.save-${randomUUID()}`);
    try {
      fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temporaryPath, fullPath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }

  static readFile(projectId: string, filePath: string): string {
    return fs.readFileSync(this.resolveFile(projectId, filePath), 'utf8');
  }

  static exists(projectId: string, filePath: string): boolean {
    return fs.existsSync(this.resolveFile(projectId, filePath));
  }

  static deleteFile(projectId: string, filePath: string): void {
    const fullPath = this.resolveFile(projectId, filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  static listFiles(projectId: string, subPath = ''): Array<{ name: string; path: string; type: 'file' | 'directory' }> {
    const dirPath = this.resolveFile(projectId, subPath, true);
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      path: path.posix.join(subPath, entry.name),
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
  }

  static createDir(projectId: string, dirPath: string): void {
    fs.mkdirSync(this.resolveFile(projectId, dirPath), { recursive: true });
  }

  static deleteDir(projectId: string, dirPath: string): void {
    fs.rmSync(this.resolveFile(projectId, dirPath), { recursive: true, force: true });
  }

  static rename(projectId: string, oldPath: string, newPath: string): void {
    const fullOldPath = this.resolveFile(projectId, oldPath);
    const fullNewPath = this.resolveFile(projectId, newPath);
    if (fullOldPath === fullNewPath) return;
    if (fs.existsSync(fullNewPath)) throw new FileValidationError('A file already exists at the destination');
    fs.mkdirSync(path.dirname(fullNewPath), { recursive: true });
    fs.renameSync(fullOldPath, fullNewPath);
  }

  static deleteProject(projectId: string): void {
    fs.rmSync(this.getProjectPath(projectId), { recursive: true, force: true });
  }
}
