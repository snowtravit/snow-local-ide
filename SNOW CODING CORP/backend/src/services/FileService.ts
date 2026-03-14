import * as fs from 'fs';
import * as path from 'path';

const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '../../projects');

export class FileService {
  /**
   * Ensure projects directory exists
   */
  static init(): void {
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }
  }

  /**
   * Get project directory path
   */
  static getProjectPath(projectId: string): string {
    return path.join(PROJECTS_DIR, projectId);
  }

  /**
   * Create project directory
   */
  static createProjectDir(projectId: string): string {
    const projectPath = this.getProjectPath(projectId);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
    return projectPath;
  }

  /**
   * Write a file to disk
   */
  static writeFile(projectId: string, filePath: string, content: string): void {
    const fullPath = path.join(this.getProjectPath(projectId), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  /**
   * Read a file from disk
   */
  static readFile(projectId: string, filePath: string): string {
    const fullPath = path.join(this.getProjectPath(projectId), filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Delete a file from disk
   */
  static deleteFile(projectId: string, filePath: string): void {
    const fullPath = path.join(this.getProjectPath(projectId), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * List files in a project directory
   */
  static listFiles(projectId: string, subPath: string = ''): Array<{ name: string; path: string; type: 'file' | 'directory' }> {
    const dirPath = path.join(this.getProjectPath(projectId), subPath);
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(subPath, entry.name).replace(/\\/g, '/'),
      type: entry.isDirectory() ? 'directory' as const : 'file' as const,
    }));
  }

  /**
   * Create a directory in a project
   */
  static createDir(projectId: string, dirPath: string): void {
    const fullPath = path.join(this.getProjectPath(projectId), dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  /**
   * Delete a directory in a project
   */
  static deleteDir(projectId: string, dirPath: string): void {
    const fullPath = path.join(this.getProjectPath(projectId), dirPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  /**
   * Rename a file or directory
   */
  static rename(projectId: string, oldPath: string, newPath: string): void {
    const fullOldPath = path.join(this.getProjectPath(projectId), oldPath);
    const fullNewPath = path.join(this.getProjectPath(projectId), newPath);
    if (fs.existsSync(fullOldPath)) {
      fs.renameSync(fullOldPath, fullNewPath);
    }
  }

  /**
   * Delete entire project directory
   */
  static deleteProject(projectId: string): void {
    const projectPath = this.getProjectPath(projectId);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  }
}
