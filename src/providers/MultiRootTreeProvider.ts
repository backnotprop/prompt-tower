import * as vscode from "vscode";
import * as path from "path";
import { FileNode, FileNodeUtils } from "../models/FileNode";
import { Workspace, ContextConfig } from "../models/Workspace";
import { FileSelectionChangeEvent } from "../models/Events";
import { WorkspaceManager } from "../services/WorkspaceManager";
import { FileDiscoveryService } from "../services/FileDiscoveryService";
import { TokenCountingService } from "../services/TokenCountingService";
import { IgnorePatternService } from "../services/IgnorePatternService";

/**
 * Tree data provider that supports multiple workspace folders
 * Replaces the monolithic PromptTowerProvider with clean architecture
 */
export class MultiRootTreeProvider
  implements vscode.TreeDataProvider<FileNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FileNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidChangeSelection =
    new vscode.EventEmitter<FileSelectionChangeEvent>();
  readonly onDidChangeSelection = this._onDidChangeSelection.event;

  private rootNodes: FileNode[] = [];
  private isInitialized = false;

  // Configuration
  private promptPrefix: string = "";
  private promptSuffix: string = "";
  private maxFileSizeWarningKB: number = 500;

  // GitHub integration
  private gitHubIssuesProvider?: any;

  constructor(
    private workspaceManager: WorkspaceManager,
    private fileDiscoveryService: FileDiscoveryService,
    private tokenCountingService: TokenCountingService,
    private ignorePatternService: IgnorePatternService,
    private context: vscode.ExtensionContext
  ) {
    this.loadConfiguration();
    this.setupEventListeners();
    this.initialize();
  }

  /**
   * Initialize the provider
   */
  private async initialize(): Promise<void> {
    console.log("MultiRootTreeProvider: Initializing...");

    try {
      await this.refreshWorkspaces();
      this.isInitialized = true;
      console.log("MultiRootTreeProvider: Initialization complete.");
    } catch (error) {
      console.error(
        "MultiRootTreeProvider: Error during initialization:",
        error
      );
      vscode.window.showErrorMessage(
        "Error initializing Prompt Tower file view."
      );
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for workspace changes
    this.workspaceManager.onDidChangeWorkspaces(async (event) => {
      console.log(`Workspace ${event.type}: ${event.workspace.name}`);
      await this.refreshWorkspaces();
    });

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("promptTower")) {
        this.loadConfiguration();
        this.refreshWorkspaces();
      }
    });
  }

  /**
   * Load configuration settings
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration("promptTower");
    this.maxFileSizeWarningKB = config.get<number>("maxFileSizeWarningKB", 500);
  }

  /**
   * Refresh all workspaces
   */
  async refreshWorkspaces(): Promise<void> {
    console.log("MultiRootTreeProvider: Refreshing workspaces...");

    // Preserve currently checked paths (both files and directories)
    const preserveCheckedPaths = new Set<string>();
    const checkedNodes = this.getAllCheckedNodes(this.rootNodes);

    console.log(`Found ${checkedNodes.length} checked nodes to preserve:`);
    for (const checkedNode of checkedNodes) {
      // Use the original absolute path without normalization to avoid path format issues
      preserveCheckedPaths.add(checkedNode.absolutePath);
      console.log(
        `  Preserving: ${checkedNode.type} ${checkedNode.absolutePath}`
      );
    }

    // Get current workspaces
    const workspaces = this.workspaceManager.getWorkspaces();

    if (workspaces.length === 0) {
      this.rootNodes = [];
      this._onDidChangeTreeData.fire();
      return;
    }

    // Setup ignore file watchers for each workspace
    for (const workspace of workspaces) {
      this.ignorePatternService.setupIgnoreFileWatchers(workspace);
    }

    // Discover files for all workspaces
    this.rootNodes = await this.fileDiscoveryService.discoverFiles(
      workspaces,
      preserveCheckedPaths
    );

    // Log results to help debug selection preservation
    const newCheckedFiles = FileNodeUtils.getCheckedFiles(this.rootNodes);
    const newCheckedNodes = this.getAllCheckedNodes(this.rootNodes);
    console.log(
      `After refresh: ${newCheckedFiles.length} files are checked, ${newCheckedNodes.length} total nodes checked`
    );

    // Explain any differences in selection count
    if (newCheckedNodes.length !== checkedNodes.length) {
      const difference = newCheckedNodes.length - checkedNodes.length;
      if (difference > 0) {
        console.log(
          `✅ Selection preservation: ${difference} new files/directories were auto-selected (likely new files in selected directories)`
        );
      } else {
        console.warn(
          `⚠️  Selection preservation issue: ${Math.abs(
            difference
          )} nodes were lost (files/directories may have been deleted)`
        );
      }
    } else {
      console.log(
        `✅ Selection preservation: All ${checkedNodes.length} selections restored perfectly`
      );
    }

    // Update token count
    this.tokenCountingService.debouncedUpdateTokenCount(this.rootNodes, 100);

    // Refresh the tree view
    this._onDidChangeTreeData.fire();

    console.log(
      `MultiRootTreeProvider: Refreshed ${this.rootNodes.length} workspace(s)`
    );
  }

  /**
   * Get all checked nodes (files and directories)
   */
  private getAllCheckedNodes(nodes: FileNode[]): FileNode[] {
    const checkedNodes: FileNode[] = [];

    for (const node of nodes) {
      if (node.isChecked) {
        checkedNodes.push(node);
      }
      if (node.children) {
        checkedNodes.push(...this.getAllCheckedNodes(node.children));
      }
    }

    return checkedNodes;
  }

  /**
   * Required by TreeDataProvider interface
   */
  getTreeItem(element: FileNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.collapsibleState
    );

    // Set context value for commands
    treeItem.contextValue = element.type;

    // Set checkbox state
    treeItem.checkboxState = element.checkable
      ? element.isChecked
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked
      : undefined;

    // Set tooltip
    if (element.type === "workspace-root") {
      treeItem.tooltip = `Workspace: ${element.workspace.name}\nPath: ${element.absolutePath}`;
    } else {
      treeItem.tooltip = element.absolutePath;
    }

    // Set icon theme for files
    if (element.type === "file") {
      treeItem.resourceUri = vscode.Uri.file(element.absolutePath);
    }

    return treeItem;
  }

  /**
   * Required by TreeDataProvider interface
   */
  async getChildren(element?: FileNode): Promise<FileNode[]> {
    if (!this.isInitialized) {
      return [];
    }

    if (!element) {
      // Return workspace root nodes
      return this.rootNodes;
    }

    // Return children of the given element
    return element.children || [];
  }

  /**
   * Toggle the checked state of a file node
   */
  async toggleNodeSelection(node: FileNode): Promise<void> {
    console.log(`Toggling selection for: ${node.label} (${node.type})`);

    const originalState = node.isChecked;
    let newState = !originalState;
    let userCancelled = false;

    try {
      // Check file size for large files
      if (newState && node.type === "file") {
        await this.checkFileSize(node.absolutePath);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "User cancelled large file selection"
      ) {
        newState = false;
        userCancelled = true;
      }
    }

    // Update the node state
    if (newState !== originalState || userCancelled) {
      // Toggle this node and its children
      FileNodeUtils.toggleCheckedState(node, newState);

      // Update parent states
      if (node.parent) {
        FileNodeUtils.updateParentCheckedState(node);
      }

      // Emit selection change event
      this._onDidChangeSelection.fire({
        node,
        isChecked: newState,
        propagateToChildren: node.type === "directory",
      });

      // Refresh the tree to show updated checkboxes
      this._onDidChangeTreeData.fire(node);

      // Update token count
      this.tokenCountingService.debouncedUpdateTokenCount(this.rootNodes);
    }
  }

  /**
   * Check file size and warn user about large files
   */
  private async checkFileSize(filePath: string): Promise<void> {
    try {
      const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      const fileSizeKB = stats.size / 1024;

      if (fileSizeKB > this.maxFileSizeWarningKB) {
        const proceed = await vscode.window.showWarningMessage(
          `File "${path.basename(filePath)}" is ${Math.round(
            fileSizeKB
          )}KB, which exceeds the warning threshold (${
            this.maxFileSizeWarningKB
          }KB). This may impact performance.`,
          "Select Anyway",
          "Cancel"
        );

        if (proceed !== "Select Anyway") {
          throw new Error("User cancelled large file selection");
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "User cancelled large file selection"
      ) {
        throw error;
      }
      // Silently ignore other errors (file might not exist, etc.)
    }
  }

  /**
   * Clear all selections
   */
  clearAllSelections(): void {
    console.log("MultiRootTreeProvider: Clearing all selections");

    let hasFileChanges = false;
    for (const rootNode of this.rootNodes) {
      const checkedFiles = FileNodeUtils.getCheckedFiles([rootNode]);
      if (checkedFiles.length > 0) {
        FileNodeUtils.toggleCheckedState(rootNode, false);
        hasFileChanges = true;
      }
    }

    // Also clear GitHub issues if provider is available
    let hasIssueChanges = false;
    if (
      this.gitHubIssuesProvider &&
      this.gitHubIssuesProvider.clearAllSelections
    ) {
      const hadIssues =
        this.gitHubIssuesProvider.getSelectedIssues().length > 0;
      this.gitHubIssuesProvider.clearAllSelections();
      hasIssueChanges = hadIssues;
    }

    if (hasFileChanges || hasIssueChanges) {
      this.tokenCountingService.resetTokenCount();
      this._onDidChangeTreeData.fire();
      vscode.window.showInformationMessage("Cleared all selections.");
    }
  }

  /**
   * Toggle all files in all workspaces
   */
  async toggleAllFiles(): Promise<void> {
    console.log("MultiRootTreeProvider: Toggling all files");

    // Check if all files are currently selected
    const allFiles = FileNodeUtils.getCheckedFiles(this.rootNodes);
    const totalFiles = this.getAllFileCount();
    const allSelected = allFiles.length === totalFiles;

    const newState = !allSelected;

    // Toggle all root nodes (which will propagate to children)
    for (const rootNode of this.rootNodes) {
      FileNodeUtils.toggleCheckedState(rootNode, newState);
    }

    // Update token count
    if (newState) {
      this.tokenCountingService.debouncedUpdateTokenCount(this.rootNodes);
    } else {
      this.tokenCountingService.resetTokenCount();
    }

    // Refresh tree
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get total count of all files across all workspaces
   */
  private getAllFileCount(): number {
    let count = 0;
    const countFiles = (node: FileNode) => {
      if (node.type === "file") {
        count++;
      }
      if (node.children) {
        node.children.forEach(countFiles);
      }
    };

    this.rootNodes.forEach(countFiles);
    return count;
  }

  /**
   * Get all currently checked files
   */
  getCheckedFiles(): FileNode[] {
    return FileNodeUtils.getCheckedFiles(this.rootNodes);
  }

  /**
   * Get all root nodes (workspace roots)
   */
  getRootNodes(): FileNode[] {
    return this.rootNodes;
  }

  /**
   * Find a node by its absolute path
   */
  findNodeByPath(absolutePath: string): FileNode | undefined {
    return this.fileDiscoveryService.findNodeByPath(
      this.rootNodes,
      absolutePath
    );
  }

  /**
   * Refresh the tree (public method for commands)
   */
  async refresh(): Promise<void> {
    await this.refreshWorkspaces();
  }

  /**
   * Set prompt prefix
   */
  setPromptPrefix(text: string): void {
    this.promptPrefix = text || "";
  }

  /**
   * Set prompt suffix
   */
  setPromptSuffix(text: string): void {
    this.promptSuffix = text || "";
  }

  /**
   * Get prompt prefix
   */
  getPromptPrefix(): string {
    return this.promptPrefix;
  }

  /**
   * Get prompt suffix
   */
  getPromptSuffix(): string {
    return this.promptSuffix;
  }

  /**
   * Get current token counting service
   */
  getTokenCountingService(): TokenCountingService {
    return this.tokenCountingService;
  }

  /**
   * Get workspace manager
   */
  getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager;
  }

  /**
   * Reset all state (for commands)
   */
  resetAll(): void {
    this.clearAllSelections(); // This now clears both files and GitHub issues
    this.setPromptPrefix("");
    this.setPromptSuffix("");
  }

  /**
   * Set the GitHub issues provider for integration
   */
  setGitHubIssuesProvider(provider: any): void {
    this.gitHubIssuesProvider = provider;

    // Listen to token changes from GitHub issues
    if (provider && provider.onDidChangeTokens) {
      provider.onDidChangeTokens((update: any) => {
        // Update token counting service with GitHub tokens
        this.tokenCountingService.setGitHubIssueTokens(
          update.totalTokens,
          update.isCounting
        );
      });
    }
  }

  /**
   * Get GitHub issues provider
   */
  getGitHubIssuesProvider(): any {
    return this.gitHubIssuesProvider;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this._onDidChangeSelection.dispose();
    this.tokenCountingService.dispose();
    this.ignorePatternService.dispose();
    this.workspaceManager.dispose();
  }
}
