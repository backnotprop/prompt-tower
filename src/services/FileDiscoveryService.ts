import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Workspace } from "../models/Workspace";
import { FileNode, FileNodeFactory, FileNodeUtils } from "../models/FileNode";
import { IgnorePatternService } from "./IgnorePatternService";

/**
 * Service for discovering files and building file trees across multiple workspaces
 */
export class FileDiscoveryService {
  constructor(private ignorePatternService: IgnorePatternService) {}
  
  /**
   * Discover all files and build file trees for multiple workspaces
   */
  async discoverFiles(workspaces: Workspace[], preserveCheckedPaths?: Set<string>): Promise<FileNode[]> {
    const rootNodes: FileNode[] = [];
    
    for (const workspace of workspaces) {
      const workspaceRoot = await this.discoverWorkspaceFiles(workspace, preserveCheckedPaths);
      if (workspaceRoot) {
        rootNodes.push(workspaceRoot);
      }
    }
    
    return rootNodes;
  }
  
  /**
   * Discover files for a single workspace and build its file tree
   */
  async discoverWorkspaceFiles(workspace: Workspace, preserveCheckedPaths?: Set<string>): Promise<FileNode | null> {
    console.log(`Discovering files for workspace: ${workspace.name}`);
    
    try {
      // Get exclude patterns for this workspace
      const excludePatterns = this.ignorePatternService.getExcludeGlobPatterns(workspace);
      const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(",")}}` : null;
      
      // Discover files using VS Code's findFiles with workspace scope
      const fileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspace.rootPath, "**/*"),
        excludePattern,
        undefined
      );
      
      console.log(`Found ${fileUris.length} files in workspace ${workspace.name}`);
      
      // Create workspace root node
      const workspaceRoot = FileNodeFactory.createWorkspaceRoot(workspace);
      
      // Build file tree
      const fileNodeMap = new Map<string, FileNode>();
      fileNodeMap.set(workspace.rootPath, workspaceRoot);
      
      // Process each discovered file
      for (const uri of fileUris) {
        const absolutePath = uri.fsPath;
        
        try {
          const stats = await fs.promises.stat(absolutePath);
          
          if (stats.isFile()) {
            this.addFileToTree(absolutePath, workspace, fileNodeMap, preserveCheckedPaths);
          }
        } catch (error) {
          console.warn(`Error processing file ${absolutePath}:`, error);
        }
      }
      
      // Build the tree structure from the flat map
      this.buildTreeStructure(workspaceRoot, fileNodeMap);
      
      console.log(`Built file tree for workspace ${workspace.name} with ${fileNodeMap.size} nodes`);
      return workspaceRoot;
      
    } catch (error) {
      console.error(`Error discovering files for workspace ${workspace.name}:`, error);
      return null;
    }
  }
  
  /**
   * Add a file and its parent directories to the tree
   */
  private addFileToTree(
    filePath: string,
    workspace: Workspace,
    fileNodeMap: Map<string, FileNode>,
    preserveCheckedPaths?: Set<string>
  ): void {
    // Skip if already processed
    if (fileNodeMap.has(filePath)) {
      return;
    }
    
    // Skip if ignored
    if (this.ignorePatternService.isPathIgnored(filePath, workspace)) {
      return;
    }
    
    // Create file node
    const relativePath = path.relative(workspace.rootPath, filePath);
    const isChecked = preserveCheckedPaths?.has(filePath) ?? false;
    
    const fileNode = FileNodeFactory.createFileNode(filePath, relativePath, workspace);
    fileNode.isChecked = isChecked;
    
    fileNodeMap.set(filePath, fileNode);
    
    // Ensure all parent directories exist
    this.ensureParentDirectories(filePath, workspace, fileNodeMap, preserveCheckedPaths);
  }
  
  /**
   * Ensure all parent directories exist in the tree
   */
  private ensureParentDirectories(
    filePath: string,
    workspace: Workspace,
    fileNodeMap: Map<string, FileNode>,
    preserveCheckedPaths?: Set<string>
  ): void {
    let currentPath = path.dirname(filePath);
    const pathsToCreate: string[] = [];
    
    // Collect all parent paths that need to be created
    while (currentPath !== workspace.rootPath && currentPath !== path.dirname(currentPath)) {
      if (!fileNodeMap.has(currentPath)) {
        pathsToCreate.unshift(currentPath); // Add to beginning to create from root down
      }
      currentPath = path.dirname(currentPath);
    }
    
    // Create directory nodes from root down
    for (const dirPath of pathsToCreate) {
      if (!fileNodeMap.has(dirPath)) {
        // Skip if ignored
        if (this.ignorePatternService.isPathIgnored(dirPath, workspace)) {
          continue;
        }
        
        // Check if directory actually exists
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
          continue;
        }
        
        const relativePath = path.relative(workspace.rootPath, dirPath);
        const isChecked = preserveCheckedPaths?.has(dirPath) ?? false;
        
        const dirNode = FileNodeFactory.createDirectoryNode(dirPath, relativePath, workspace);
        dirNode.isChecked = isChecked;
        
        fileNodeMap.set(dirPath, dirNode);
      }
    }
  }
  
  /**
   * Build the hierarchical tree structure from the flat file map
   */
  private buildTreeStructure(workspaceRoot: FileNode, fileNodeMap: Map<string, FileNode>): void {
    // Group nodes by their parent directory
    const nodesByParent = new Map<string, FileNode[]>();
    
    for (const [filePath, node] of fileNodeMap) {
      if (node === workspaceRoot) {
        continue; // Skip workspace root
      }
      
      const parentPath = path.dirname(filePath);
      
      if (!nodesByParent.has(parentPath)) {
        nodesByParent.set(parentPath, []);
      }
      nodesByParent.get(parentPath)!.push(node);
    }
    
    // Assign children to their parents
    for (const [parentPath, children] of nodesByParent) {
      const parentNode = fileNodeMap.get(parentPath);
      
      if (parentNode) {
        // Sort children: directories first, then files, alphabetically
        children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });
        
        parentNode.children = children;
        
        // Set parent references
        for (const child of children) {
          child.parent = parentNode;
        }
      }
    }
  }
  
  /**
   * Refresh a specific workspace's file tree
   */
  async refreshWorkspace(workspace: Workspace, preserveCheckedPaths?: Set<string>): Promise<FileNode | null> {
    console.log(`Refreshing workspace: ${workspace.name}`);
    return this.discoverWorkspaceFiles(workspace, preserveCheckedPaths);
  }
  
  /**
   * Get all checked file paths from a tree
   */
  getCheckedFilePaths(rootNodes: FileNode[]): string[] {
    const checkedFiles = FileNodeUtils.getCheckedFiles(rootNodes);
    return checkedFiles.map(node => node.absolutePath);
  }
  
  /**
   * Find a file node by its absolute path
   */
  findNodeByPath(rootNodes: FileNode[], absolutePath: string): FileNode | undefined {
    for (const rootNode of rootNodes) {
      const found = this.findNodeInTree(rootNode, absolutePath);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  
  /**
   * Recursively find a node in a tree by absolute path
   */
  private findNodeInTree(node: FileNode, absolutePath: string): FileNode | undefined {
    if (node.absolutePath === absolutePath) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeInTree(child, absolutePath);
        if (found) {
          return found;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Update file size information for file nodes
   */
  async updateFileSizes(rootNodes: FileNode[]): Promise<void> {
    const fileNodes = this.getAllFileNodes(rootNodes);
    
    for (const node of fileNodes) {
      if (node.type === 'file') {
        try {
          const stats = await fs.promises.stat(node.absolutePath);
          node.sizeBytes = stats.size;
        } catch (error) {
          console.warn(`Error getting file size for ${node.absolutePath}:`, error);
        }
      }
    }
  }
  
  /**
   * Get all file nodes from multiple root nodes
   */
  private getAllFileNodes(rootNodes: FileNode[]): FileNode[] {
    const allNodes: FileNode[] = [];
    
    const collectNodes = (node: FileNode) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };
    
    rootNodes.forEach(collectNodes);
    return allNodes;
  }
  
  /**
   * Check if a file should be included based on current filters
   */
  shouldIncludeFile(filePath: string, workspace: Workspace): boolean {
    return !this.ignorePatternService.isPathIgnored(filePath, workspace);
  }
}