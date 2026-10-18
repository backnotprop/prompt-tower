import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import ignore from "ignore";
import { Workspace, IgnorePatterns } from "../models/Workspace";
import { ALWAYS_IGNORE } from "../utils/alwaysIgnore";

/**
 * Service for managing ignore patterns across multiple workspaces
 */
export class IgnorePatternService {
  private ignoreInstanceCache = new Map<string, ignore.Ignore>();
  private patternCache = new Map<string, IgnorePatterns>();
  private scopedIgnoreCache = new Map<string, Map<string, {
    git: ignore.Ignore;
    all: ignore.Ignore;
  }>>();
  private fileWatchers = new Map<string, vscode.FileSystemWatcher[]>();
  
  constructor(private context: vscode.ExtensionContext) {
    this.setupConfigurationWatcher();
  }
  
  /**
   * Get ignore patterns for a workspace
   */
  getIgnorePatterns(workspace: Workspace): IgnorePatterns {
    if (this.patternCache.has(workspace.id)) {
      return this.patternCache.get(workspace.id)!;
    }
    
    const patterns = this.loadIgnorePatterns(workspace);
    this.patternCache.set(workspace.id, patterns);
    return patterns;
  }
  
  /**
   * Get configured ignore instance for a workspace
   */
  getIgnoreInstance(workspace: Workspace): ignore.Ignore {
    if (this.ignoreInstanceCache.has(workspace.id)) {
      return this.ignoreInstanceCache.get(workspace.id)!;
    }
    
    const instance = this.createIgnoreInstance(workspace);
    this.ignoreInstanceCache.set(workspace.id, instance);
    return instance;
  }
  
  /**
   * Check if a path should be ignored in a specific workspace
   */
  isPathIgnored(absolutePath: string, workspace: Workspace): boolean {
    const relativePath = path.relative(workspace.rootPath, absolutePath);
    if (!relativePath) {
      return false;
    }
    if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      return true;
    }
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const patterns = this.getIgnorePatterns(workspace);
    let scopes = this.scopedIgnoreCache.get(workspace.id);
    if (!scopes) {
      scopes = new Map();
      scopes.set('', {
        git: ignore().add(patterns.builtin).add(patterns.gitignore),
        all: this.getIgnoreInstance(workspace)
      });
      this.scopedIgnoreCache.set(workspace.id, scopes);
    }

    let scope = scopes.get('')!;
    const useGitIgnore = vscode.workspace.getConfiguration("promptTower")
      .get<boolean>("useGitignore", true);
    const parts = normalizedPath.split('/');
    if (useGitIgnore) {
      for (let i = 1; i < parts.length; i++) {
        const directory = parts.slice(0, i).join('/');
        // Git never reads ignore files inside an excluded parent directory.
        if (scope.all.ignores(`${directory}/`)) {
          return true;
        }
        let nested = scopes.get(directory);
        if (!nested) {
          const nestedPatterns = this.loadIgnoreFile(
            path.join(workspace.rootPath, directory, '.gitignore')
          );
          const git = ignore().add(scope.git)
            .add(this.scopePatterns(nestedPatterns, directory));
          nested = {
            git,
            all: ignore().add(git).add(patterns.towerignore).add(patterns.manual)
          };
          scopes.set(directory, nested);
        }
        scope = nested;
      }
    }

    let isDirectory = false;
    try {
      isDirectory = fs.statSync(absolutePath).isDirectory();
    } catch {
      // A file may disappear between discovery and filtering.
    }
    return scope.all.ignores(normalizedPath + (isDirectory ? '/' : ''));
  }

  /** Rebase nested Git patterns without changing their anchoring or negation. */
  private scopePatterns(patterns: string[], directory: string): string[] {
    // ignore does not support escaping '?' in prefixes. A bare '?' is safe:
    // this matcher is only queried within its literal cached directory.
    const prefix = directory.replace(/([*\[\]\\])/g, '\\$1');
    return patterns.flatMap(pattern => {
      const negated = pattern.startsWith('!');
      const original = negated ? pattern.slice(1) : pattern;
      const anchored = original.startsWith('/');
      const relative = anchored ? original.slice(1) : original;
      if (!relative) {
        return [];
      }
      const basename = !relative.replace(/\/$/, '').includes('/');
      return [`${negated ? '!' : ''}/${prefix}/${!anchored && basename ? '**/' : ''}${relative}`];
    });
  }
  
  /**
   * Setup workspace-specific file watchers for ignore files
   */
  setupIgnoreFileWatchers(workspace: Workspace): void {
    // Don't setup watchers multiple times for the same workspace
    if (this.fileWatchers.has(workspace.id)) {
      return;
    }
    
    const watchers: vscode.FileSystemWatcher[] = [];
    
    // Watch root and nested .gitignore files
    const gitignoreWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspace.rootPath, "**/.gitignore")
    );
    
    // Watch .towerignore
    const towerignoreWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspace.rootPath, ".towerignore")
    );
    
    // Common handler for all ignore file changes
    const handleIgnoreFileChange = (fileName: string) => {
      console.log(`Ignore file changed in workspace ${workspace.name}: ${fileName}`);
      this.invalidateCache(workspace);
    };
    
    // Setup gitignore watchers
    gitignoreWatcher.onDidCreate(() => handleIgnoreFileChange('.gitignore'));
    gitignoreWatcher.onDidChange(() => handleIgnoreFileChange('.gitignore'));
    gitignoreWatcher.onDidDelete(() => handleIgnoreFileChange('.gitignore'));
    
    // Setup towerignore watchers
    towerignoreWatcher.onDidCreate(() => handleIgnoreFileChange('.towerignore'));
    towerignoreWatcher.onDidChange(() => handleIgnoreFileChange('.towerignore'));
    towerignoreWatcher.onDidDelete(() => handleIgnoreFileChange('.towerignore'));
    
    watchers.push(gitignoreWatcher, towerignoreWatcher);
    this.fileWatchers.set(workspace.id, watchers);
    
    // Add to context subscriptions for proper disposal
    this.context.subscriptions.push(...watchers);
  }
  
  /**
   * Load ignore patterns from all sources for a workspace
   */
  private loadIgnorePatterns(workspace: Workspace): IgnorePatterns {
    return {
      gitignore: this.loadGitIgnorePatterns(workspace),
      towerignore: this.loadTowerIgnorePatterns(workspace),
      manual: [], // No longer using JSON config
      builtin: ALWAYS_IGNORE
    };
  }
  
  /**
   * Load .gitignore patterns for a workspace
   */
  private loadGitIgnorePatterns(workspace: Workspace): string[] {
    const config = vscode.workspace.getConfiguration("promptTower");
    const useGitIgnore = config.get<boolean>("useGitignore", true);
    
    if (!useGitIgnore) {
      return [];
    }
    
    const gitignorePath = path.join(workspace.rootPath, ".gitignore");
    return this.loadIgnoreFile(gitignorePath);
  }
  
  /**
   * Load .towerignore patterns for a workspace
   */
  private loadTowerIgnorePatterns(workspace: Workspace): string[] {
    const towerignorePath = path.join(workspace.rootPath, ".towerignore");
    return this.loadIgnoreFile(towerignorePath);
  }
  
  /**
   * Load patterns from an ignore file
   */
  private loadIgnoreFile(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"));
    } catch (error) {
      console.error(`Error reading ignore file ${filePath}:`, error);
      return [];
    }
  }
  
  /**
   * Create an ignore instance for a workspace
   */
  private createIgnoreInstance(workspace: Workspace): ignore.Ignore {
    const patterns = this.getIgnorePatterns(workspace);
    const instance = ignore();
    
    // Add all pattern sources to the ignore instance
    instance.add(patterns.builtin);
    instance.add(patterns.gitignore);
    instance.add(patterns.towerignore);
    instance.add(patterns.manual);
    
    return instance;
  }
  
  /**
   * Invalidate cache for a workspace (e.g., when ignore files change)
   */
  private invalidateCache(workspace: Workspace): void {
    this.patternCache.delete(workspace.id);
    this.ignoreInstanceCache.delete(workspace.id);
    this.scopedIgnoreCache.delete(workspace.id);
  }
  
  /**
   * Setup configuration watcher for gitignore setting
   */
  private setupConfigurationWatcher(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("promptTower.useGitignore")) {
        // Clear all caches when configuration changes
        this.patternCache.clear();
        this.ignoreInstanceCache.clear();
        this.scopedIgnoreCache.clear();
        console.log("Ignore pattern configuration changed, clearing cache");
      }
    });
  }
  
  /**
   * Get glob patterns suitable for vscode.workspace.findFiles exclude parameter
   */
  getExcludeGlobPatterns(workspace: Workspace): string[] {
    const patterns = this.getIgnorePatterns(workspace);
    const allPatterns = [
      ...patterns.builtin,
      // Git rules need scoped evaluation: a nested negation may re-include a file.
      ...patterns.towerignore,
      ...patterns.manual
    ];
    
    const globs: string[] = [];
    
    allPatterns.forEach((pattern) => {
      // Convert ignore patterns to findFiles-compatible globs
      if (pattern.endsWith("/")) {
        // Directory pattern like "node_modules/"
        globs.push(`**/${pattern}**`);
      } else if (pattern.includes("*")) {
        // Already a glob pattern
        if (!pattern.startsWith("**/")) {
          globs.push(`**/${pattern}`);
        } else {
          globs.push(pattern);
        }
      } else if (pattern.startsWith(".")) {
        // Hidden file like ".DS_Store"
        globs.push(`**/${pattern}`);
      } else {
        // Simple name - could be file or directory
        globs.push(`**/${pattern}`);
        globs.push(`**/${pattern}/**`);
      }
    });
    
    return [...new Set(globs)]; // Remove duplicates
  }
  
  /**
   * Cleanup resources for a workspace
   */
  cleanupWorkspace(workspace: Workspace): void {
    // Dispose file watchers
    const watchers = this.fileWatchers.get(workspace.id);
    if (watchers) {
      watchers.forEach(watcher => watcher.dispose());
      this.fileWatchers.delete(workspace.id);
    }
    
    // Clear caches
    this.patternCache.delete(workspace.id);
    this.ignoreInstanceCache.delete(workspace.id);
    this.scopedIgnoreCache.delete(workspace.id);
  }
  
  /**
   * Dispose all resources
   */
  dispose(): void {
    // Dispose all file watchers
    for (const watchers of this.fileWatchers.values()) {
      watchers.forEach(watcher => watcher.dispose());
    }
    this.fileWatchers.clear();
    
    // Clear all caches
    this.patternCache.clear();
    this.ignoreInstanceCache.clear();
    this.scopedIgnoreCache.clear();
  }
}