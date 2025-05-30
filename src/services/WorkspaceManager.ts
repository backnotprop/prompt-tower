import * as vscode from "vscode";
import * as path from "path";
import { Workspace } from "../models/Workspace";
import { WorkspaceChangeEvent } from "../models/Events";

/**
 * Manages multi-folder workspaces and provides workspace-related operations
 */
export class WorkspaceManager {
  private _workspaces: Workspace[] = [];
  private _onDidChangeWorkspaces = new vscode.EventEmitter<WorkspaceChangeEvent>();
  
  readonly onDidChangeWorkspaces = this._onDidChangeWorkspaces.event;
  
  constructor() {
    this.initialize();
    this.setupWorkspaceWatchers();
  }
  
  /**
   * Initialize workspace discovery
   */
  private initialize(): void {
    this._workspaces = this.discoverWorkspaces();
  }
  
  /**
   * Discover all workspace folders and create Workspace objects
   */
  private discoverWorkspaces(): Workspace[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }
    
    return workspaceFolders.map((folder, index) => {
      const resolvedPath = this.resolvePath(folder.uri.fsPath, workspaceFolders);
      
      return {
        id: this.generateWorkspaceId(folder),
        name: folder.name || path.basename(resolvedPath),
        rootPath: resolvedPath,
        uri: folder.uri.toString(),
        index
      };
    });
  }
  
  /**
   * Resolve relative paths to absolute paths
   * This handles cases like {"path": "../other-project"}
   */
  private resolvePath(workspacePath: string, allFolders: readonly vscode.WorkspaceFolder[]): string {
    // If path is already absolute, return as-is
    if (path.isAbsolute(workspacePath)) {
      return workspacePath;
    }
    
    // For relative paths, resolve against the workspace file location
    // or against the first workspace folder if no workspace file exists
    const workspaceFile = vscode.workspace.workspaceFile;
    
    if (workspaceFile && workspaceFile.scheme === 'file') {
      // Resolve against workspace file directory
      const workspaceDir = path.dirname(workspaceFile.fsPath);
      return path.resolve(workspaceDir, workspacePath);
    } else if (allFolders.length > 0) {
      // Fallback: resolve against first folder that's absolute
      const firstAbsoluteFolder = allFolders.find(f => path.isAbsolute(f.uri.fsPath));
      if (firstAbsoluteFolder) {
        return path.resolve(path.dirname(firstAbsoluteFolder.uri.fsPath), workspacePath);
      }
    }
    
    // Last resort: resolve against current working directory
    return path.resolve(process.cwd(), workspacePath);
  }
  
  /**
   * Generate a unique ID for a workspace folder
   */
  private generateWorkspaceId(folder: vscode.WorkspaceFolder): string {
    // Use a combination of name and URI to ensure uniqueness
    const name = folder.name?.replace(/[^a-zA-Z0-9]/g, '') || 'workspace';
    const pathHash = this.hashString(folder.uri.toString());
    return `${name}_${pathHash.substring(0, 8)}`;
  }
  
  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Setup watchers for workspace changes
   */
  private setupWorkspaceWatchers(): void {
    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      // Handle added folders
      for (const added of event.added) {
        const newWorkspace: Workspace = {
          id: this.generateWorkspaceId(added),
          name: added.name || path.basename(added.uri.fsPath),
          rootPath: this.resolvePath(added.uri.fsPath, vscode.workspace.workspaceFolders || []),
          uri: added.uri.toString(),
          index: this._workspaces.length
        };
        
        this._workspaces.push(newWorkspace);
        this._onDidChangeWorkspaces.fire({ type: 'added', workspace: newWorkspace });
      }
      
      // Handle removed folders
      for (const removed of event.removed) {
        const removedWorkspace = this._workspaces.find(w => w.uri === removed.uri.toString());
        if (removedWorkspace) {
          this._workspaces = this._workspaces.filter(w => w.id !== removedWorkspace.id);
          this._onDidChangeWorkspaces.fire({ type: 'removed', workspace: removedWorkspace });
        }
      }
      
      // Rebuild index numbers
      this._workspaces.forEach((workspace, index) => {
        workspace.index = index;
      });
    });
  }
  
  /**
   * Get all discovered workspaces
   */
  getWorkspaces(): Workspace[] {
    return [...this._workspaces];
  }
  
  /**
   * Get workspace by ID
   */
  getWorkspaceById(id: string): Workspace | undefined {
    return this._workspaces.find(w => w.id === id);
  }
  
  /**
   * Get workspace that contains the given file path
   */
  getWorkspaceForPath(filePath: string): Workspace | undefined {
    // Normalize the file path
    const normalizedPath = path.resolve(filePath);
    
    // Find the workspace whose root path is a parent of the file path
    // Sort by root path length (descending) to find the most specific match
    const sortedWorkspaces = this._workspaces
      .filter(workspace => {
        const workspaceRoot = path.resolve(workspace.rootPath);
        return normalizedPath.startsWith(workspaceRoot + path.sep) || normalizedPath === workspaceRoot;
      })
      .sort((a, b) => b.rootPath.length - a.rootPath.length);
    
    return sortedWorkspaces[0];
  }
  
  /**
   * Get relative path within a workspace
   */
  getRelativePath(filePath: string, workspace: Workspace): string {
    const normalizedFilePath = path.resolve(filePath);
    const normalizedWorkspacePath = path.resolve(workspace.rootPath);
    
    return path.relative(normalizedWorkspacePath, normalizedFilePath);
  }
  
  /**
   * Check if any workspaces are configured
   */
  hasWorkspaces(): boolean {
    return this._workspaces.length > 0;
  }
  
  /**
   * Check if there are multiple workspaces
   */
  isMultiWorkspace(): boolean {
    return this._workspaces.length > 1;
  }
  
  /**
   * Get the primary workspace (first one, for backward compatibility)
   */
  getPrimaryWorkspace(): Workspace | undefined {
    return this._workspaces[0];
  }
  
  /**
   * Refresh workspace discovery (useful after configuration changes)
   */
  refresh(): void {
    const oldWorkspaces = [...this._workspaces];
    this.initialize();
    
    // Fire change events for any differences
    const newWorkspaces = this._workspaces;
    
    // Check for removed workspaces
    for (const oldWorkspace of oldWorkspaces) {
      if (!newWorkspaces.find(w => w.id === oldWorkspace.id)) {
        this._onDidChangeWorkspaces.fire({ type: 'removed', workspace: oldWorkspace });
      }
    }
    
    // Check for added workspaces
    for (const newWorkspace of newWorkspaces) {
      if (!oldWorkspaces.find(w => w.id === newWorkspace.id)) {
        this._onDidChangeWorkspaces.fire({ type: 'added', workspace: newWorkspace });
      }
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onDidChangeWorkspaces.dispose();
  }
}