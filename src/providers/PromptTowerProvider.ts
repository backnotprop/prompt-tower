/**
 * @TODO
 * - config listeners
 * - ignore could be more robust?
 * - "format path as comment" (need config and implementation)
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileItem } from "../models/FileItem";
import { encode } from "gpt-tokenizer";
import { TokenUpdateEmitter } from "../models/EventEmitter";

import { generateFileStructureTree } from "../utils/fileTree";
import { ALWAYS_IGNORE } from "../utils/alwaysIgnore";

interface StructuredFilePath {
  origin: string; // Absolute path on disk
  tree: string; // Path relative to the workspace root
}

export class PromptTowerProvider implements vscode.TreeDataProvider<FileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FileItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private items = new Map<string, FileItem>();
  private excludedPatterns: string[] = ALWAYS_IGNORE;

  private maxFileSizeWarningKB: number = 500;

  private blockTemplate: string =
    '<file name="{fileNameWithExtension}" path="{rawFilePath}">\n{fileContent}\n</file>';
  private blockSeparator: string = "\n";

  private projectTreeEnabled: boolean = true;
  private projectTreeType: string = "fullFilesAndDirectories";
  private projectTreeShowFileSize: boolean = true;
  private projectTreeTemplate: string =
    "<project_tree>\n{projectTree}\n</project_tree>\n";

  private wrapperTemplate: string | null =
    "<context>\n{treeBlock}<project_files>\n{blocks}\n</project_files>\n</context>";

  // --- Token Counting State ---
  private totalTokenCount: number = 0;
  private isCountingTokens: boolean = false;
  private currentTokenCalculationVersion = 0; // For cancellation

  private promptPrefix: string = "";
  private promptSuffix: string = "";

  private resetWebviewPreview: () => void;
  private invalidateWebviewPreview: () => void;

  constructor(
    private workspaceRoot: string,
    private context: vscode.ExtensionContext,
    private tokenUpdateEmitter: TokenUpdateEmitter,
    resetWebviewPreview: () => void,
    invalidateWebviewPreview: () => void
  ) {
    this.resetWebviewPreview = resetWebviewPreview;
    this.invalidateWebviewPreview = invalidateWebviewPreview;
    this.loadConfig();

    // **Initialize items asynchronously**
    this.initializeWorkspaceItems()
      .then(() => {
        this.debouncedUpdateTokenCount(100);

        // **Refresh the tree view explicitly AFTER init and state load**
        this._onDidChangeTreeData.fire();

        console.log("Prompt Tower: Initialization complete.");
      })
      .catch((error) => {
        console.error("Prompt Tower: Error during initialization:", error);
        vscode.window.showErrorMessage(
          "Error initializing Prompt Tower file view."
        );
      });

    this.setupIgnoreFileWatchers();
    // this.setupWorkspaceFileWatcher();
  }

  setPromptPrefix(text: string): void {
    this.promptPrefix = text ?? ""; // Ensure it's a string
    // Optionally trigger token recount if prefix/suffix should be counted
    // this.debouncedUpdateTokenCount();
  }

  setPromptSuffix(text: string): void {
    this.promptSuffix = text ?? ""; // Ensure it's a string
    // Optionally trigger token recount if prefix/suffix should be counted
    // this.debouncedUpdateTokenCount();
  }

  // Methods to get current prefix/suffix (for sending to webview)
  getPromptPrefix(): string {
    return this.promptPrefix;
  }

  getPromptSuffix(): string {
    return this.promptSuffix;
  }

  // Helper to format patterns for findFiles exclude
  // Add an optional parameter to accept paths that should remain checked
  private async initializeWorkspaceItems(
    preserveCheckedPaths?: Set<string>
  ): Promise<void> {
    console.log("Prompt Tower: Initializing workspace items...");
    // Keep track of the new items being built
    const newItems = new Map<string, FileItem>();
    // NOTE: We don't clear this.items immediately anymore,
    // but build newItems first and replace at the end.

    const configExcludes = this.getExcludedGlobsForFindFiles();
    const excludePattern =
      configExcludes.length > 0 ? `{${configExcludes.join(",")}}` : null;

    const fileUris = await vscode.workspace.findFiles(
      "**/*",
      excludePattern,
      undefined
    );

    console.log(`Prompt Tower: Found ${fileUris.length} files via findFiles.`);
    const discoveredPaths = new Set<string>();

    for (const uri of fileUris) {
      const filePath = uri.fsPath;
      if (discoveredPaths.has(filePath)) {
        continue;
      }

      // --- Process the File ---
      if (!newItems.has(filePath)) {
        // Check newItems map
        try {
          const stats = await fs.promises.stat(filePath);
          if (stats.isFile()) {
            const isChecked = preserveCheckedPaths?.has(filePath) ?? false;
            const fileItem = new FileItem(
              path.basename(filePath),
              vscode.TreeItemCollapsibleState.None,
              filePath,
              isChecked // Use preserved state or default false
            );
            newItems.set(filePath, fileItem); // Add to newItems
            discoveredPaths.add(filePath);
          } else {
            console.warn(
              `findFiles returned a non-file, skipping: ${filePath}`
            );
            continue;
          }
        } catch (e) {
          console.warn(`Error stating file during init ${filePath}:`, e);
          continue;
        }
      }

      // --- Process Parent Directories ---
      let currentDirPath = path.dirname(filePath);
      while (
        currentDirPath !== this.workspaceRoot &&
        currentDirPath !== path.dirname(currentDirPath)
      ) {
        if (discoveredPaths.has(currentDirPath)) {
          break;
        }

        if (
          !this.isPathExcluded(currentDirPath) && // Still check exclusion for dirs
          fs.existsSync(currentDirPath) &&
          fs.statSync(currentDirPath).isDirectory()
        ) {
          if (!newItems.has(currentDirPath)) {
            // Check newItems map

            const isChecked =
              preserveCheckedPaths?.has(currentDirPath) ?? false;
            const dirItem = new FileItem(
              path.basename(currentDirPath),
              vscode.TreeItemCollapsibleState.Collapsed,
              currentDirPath,
              isChecked // Use preserved state or default false
            );
            newItems.set(currentDirPath, dirItem); // Add to newItems
            discoveredPaths.add(currentDirPath);
          }
        } else {
          break;
        }
        currentDirPath = path.dirname(currentDirPath);
      }
    }

    this.items = newItems;
    console.log(
      `Prompt Tower: Populated ${this.items.size} items (preserving check state where possible).`
    );
  }

  private getExcludedGlobsForFindFiles(): string[] {
    // findFiles glob patterns often need slightly different formatting than basic matching
    // - Directories usually need `**` (e.g., `**/node_modules/**`)
    // - Simple file patterns are often okay (e.g., `**/*.log`)

    const globs: string[] = [];

    this.excludedPatterns.forEach((pattern) => {
      // Basic conversion attempt (needs refinement based on pattern types)
      if (pattern.endsWith("/")) {
        // Directory pattern like "node_modules/"6
        globs.push(`**/${pattern}**`); // Exclude folder and its contents
      } else if (pattern.includes("*")) {
        // Assume it's already a glob
        // May need prefixing with **/ if it's just "*.log"
        if (!pattern.startsWith("**/")) {
          globs.push(`**/${pattern}`);
        } else {
          globs.push(pattern);
        }
      } else if (pattern.startsWith(".")) {
        // Hidden file like ".DS_Store"
        globs.push(`**/${pattern}`);
      } else {
        // Simple name like "dist" or "output.txt"
        // Need to exclude both file and directory possibilities if ambiguous
        globs.push(`**/${pattern}`); // As file anywhere
        globs.push(`**/${pattern}/**`); // As directory anywhere
      }
    });
    return [...new Set(globs)]; // Remove duplicates
  }

  // Helper to check if a specific absolute path should be excluded
  // (Uses the original patterns, not the findFiles globs)
  private isPathExcluded(absolutePath: string): boolean {
    const relativePath = path.relative(this.workspaceRoot, absolutePath);
    const baseName = path.basename(absolutePath);

    // Check against ALWAYS_IGNORE first for efficiency
    if (
      ALWAYS_IGNORE.some((pattern) => this.matchesPattern(baseName, pattern))
    ) {
      return true;
    }

    // Use micromatch or similar for better glob matching against relative path
    // For now, using the basic matchesPattern:
    return this.excludedPatterns.some((pattern) => {
      // Check basename match (e.g., "node_modules")
      if (this.matchesPattern(baseName, pattern)) {
        return true;
      }
      // Check relative path match (more complex patterns - less reliable with basic matcher)
      // TODO: Use a proper glob library here if needed (e.g., micromatch)
      // Example: if (micromatch.isMatch(relativePath, pattern)) return true;
      return false;
    });
  }

  // --- Token Counting Logic Helpers ---

  private notifyTokenUpdate() {
    // Fire event only if emitter exists (it should, but defensive check)
    if (this.tokenUpdateEmitter) {
      this.tokenUpdateEmitter.fire({
        count: this.totalTokenCount,
        isCounting: this.isCountingTokens,
      });
    }
  }

  // Debounce function
  private debounceTimeout: NodeJS.Timeout | null = null;
  private debouncedUpdateTokenCount = (delay: number = 300) => {
    // Always clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    // Invalidate any ongoing calculation immediately because a new trigger occurred
    this.currentTokenCalculationVersion++;

    // Set a new timeout
    this.debounceTimeout = setTimeout(() => {
      // Trigger the actual update after the delay
      this.updateTokenCount();
    }, delay);
  };

  // --- Getters for current state (used by extension.ts for initial webview update) ---
  getCurrentTokenCount(): number {
    return this.totalTokenCount;
  }

  getIsCounting(): boolean {
    return this.isCountingTokens;
  }

  async updateTokenCount(): Promise<void> {
    // Capture the version intended for *this specific run*
    const calculationVersion = this.currentTokenCalculationVersion;

    // Get currently checked files that exist
    const checkedFiles = this.getCheckedFiles();

    // --- Handle No Files Selected ---
    if (checkedFiles.length === 0) {
      // Check if a newer calculation has already started
      if (calculationVersion !== this.currentTokenCalculationVersion) {
        return;
      }

      this.totalTokenCount = 0;
      this.isCountingTokens = false;
      this.notifyTokenUpdate();
      console.log(
        `Token count reset to 0 (Version ${calculationVersion} - no files selected).`
      );
      return;
    }

    // --- Start Counting ---
    console.log(
      `Token counting started (Version ${calculationVersion}) for ${checkedFiles.length} files.`
    );
    this.isCountingTokens = true;
    this.notifyTokenUpdate(); // Notify UI that counting started

    let runningTokenCount = 0;
    let filesProcessed = 0;

    try {
      for (const filePath of checkedFiles) {
        // --- Cancellation Check (Start of Loop) ---
        if (calculationVersion !== this.currentTokenCalculationVersion) {
          console.log(
            `Token counting cancelled (Version ${calculationVersion}). Newer version exists.`
          );
          // Don't change state here; let the newer calculation take over.
          return; // Stop this outdated calculation
        }

        try {
          // Double-check existence before reading, as getCheckedFiles might race
          // Although getCheckedFiles now filters, this is extra safety.
          if (!fs.existsSync(filePath)) {
            console.warn(
              `Skipping token count for non-existent file during loop: ${filePath}`
            );
            this.items.delete(filePath); // Clean up map
            continue;
          }
          const content = await fs.promises.readFile(filePath, "utf-8");
          const tokens = encode(content); // Count tokens
          runningTokenCount += tokens.length;
          filesProcessed++;

          // --- Yielding for Responsiveness (Optional but Recommended) ---
          if (filesProcessed % 50 === 0) {
            // Yield every 50 files
            await new Promise((resolve) => setImmediate(resolve));
            // Check for cancellation again after yielding
            if (calculationVersion !== this.currentTokenCalculationVersion) {
              console.log(
                `Token counting cancelled during yield (Version ${calculationVersion}).`
              );
              return; // Stop this outdated calculation
            }
          }
        } catch (err: any) {
          // Handle specific file read/encode errors
          if (err.code === "ENOENT") {
            console.warn(`File not found during token count loop: ${filePath}`);
            this.items.delete(filePath); // Clean up map
          } else if (
            err instanceof Error &&
            err.message?.includes("is too large")
          ) {
            console.warn(`Skipping large file during token count: ${filePath}`);
            // Optionally show a less intrusive warning once?
          } else {
            console.error(
              `Error processing file for token count ${filePath}:`,
              err
            );
            // Potentially notify user once about general errors?
          }
          // Continue with the next file even if one fails
        }
      } // End of for loop

      // --- Final Cancellation Check ---
      if (calculationVersion !== this.currentTokenCalculationVersion) {
        console.log(
          `Token counting cancelled before final update (Version ${calculationVersion}).`
        );
        return; // Stop if a newer calculation finished during the loop
      }

      // --- Update Final State ---
      this.totalTokenCount = runningTokenCount;
      this.isCountingTokens = false;
      console.log(
        `Token counting finished (Version ${calculationVersion}). Total tokens: ${this.totalTokenCount}`
      );
    } catch (error) {
      // Catch unexpected errors in the overall process
      console.error("Unexpected error during token counting process:", error);
      // Ensure state is reset if this calculation was the latest one
      if (calculationVersion === this.currentTokenCalculationVersion) {
        this.isCountingTokens = false;
        // Maybe set count to -1 or NaN to indicate error? Or keep last known good?
        // Let's keep the count as it was before the error for now.
      }
    } finally {
      // --- Notify UI (only if this calculation is still the latest) ---
      if (calculationVersion === this.currentTokenCalculationVersion) {
        // Ensure isCounting is false, even if errors occurred mid-way
        this.isCountingTokens = false;
        this.notifyTokenUpdate(); // Send final state
      }
      // If not the latest, the newer calculation's finally block will notify.
    }
  }

  // Required by TreeDataProvider interface
  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  // Required by TreeDataProvider interface
  async getChildren(element?: FileItem): Promise<FileItem[]> {
    const dirPath = element ? element.filePath : this.workspaceRoot;
    // console.log(`getChildren called for: ${dirPath}`); // Debug logging

    // Filter items directly from the map
    const children: FileItem[] = [];
    for (const item of this.items.values()) {
      // Check if the item's parent directory is the element's path
      if (path.dirname(item.filePath) === dirPath) {
        // Additional check: Ensure item itself is not excluded,
        // although initializeWorkspaceItems should prevent this. Safety check.
        // if (!this.isPathExcluded(item.filePath)) { // Potentially redundant
        children.push(item);
        // }
      }
    }

    // console.log(`Found ${children.length} children in map for ${dirPath}`);

    // --- Sorting (same as before) ---
    children.sort((a, b) => {
      const aIsFolder =
        a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
      const bIsFolder =
        b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    return children; // Return directly from the map
  }

  async refresh(): Promise<void> {
    console.log("Prompt Tower: Refresh requested.");
    // Re-run the initialization process
    await this.initializeWorkspaceItems();
    // Update the tree view UI
    this._onDidChangeTreeData.fire();
    // Recalculate tokens
    this.debouncedUpdateTokenCount();
    // Invalidate webview
    this.invalidateWebviewPreview();
    console.log("Prompt Tower: Refresh complete.");
  }

  resetAll(): void {
    for (const [, item] of this.items) {
      if (item.isChecked) {
        item.updateCheckState(false); // Set to unchecked
      }
    }

    this.resetWebviewPreview();

    this.currentTokenCalculationVersion++; // Invalidate any ongoing count *immediately*
    this.totalTokenCount = 0;
    this.isCountingTokens = false;
    this.notifyTokenUpdate(); // Instantly update UI to 0
    console.log("Token count reset to 0 (Cleared all selections).");

    this.setPromptPrefix("");
    this.setPromptSuffix("");

    // Refresh the TreeView UI AFTER updating state and tokens
    this._onDidChangeTreeData.fire();
  }

  clearAllSelections(): void {
    console.log("Prompt Tower: Clearing all selections.");
    let changed = false;
    // Update internal state first
    for (const [, item] of this.items) {
      if (item.isChecked) {
        item.updateCheckState(false); // Set to unchecked
        changed = true;
      }
    }

    if (!changed) {
      console.log("Prompt Tower: No selections to clear.");
      // Optionally show a message? vscode.window.showInformationMessage("No files were selected.");
      return; // Exit if nothing changed
    }

    this.invalidateWebviewPreview();

    // --- Token Count Update ---
    this.currentTokenCalculationVersion++; // Invalidate any ongoing count *immediately*
    this.totalTokenCount = 0;
    this.isCountingTokens = false;
    this.notifyTokenUpdate(); // Instantly update UI to 0
    console.log("Token count reset to 0 (Cleared all selections).");

    // Refresh the TreeView UI AFTER updating state and tokens
    this._onDidChangeTreeData.fire();

    // Optionally provide feedback
    vscode.window.showInformationMessage("Cleared all file selections.");
  }

  async toggleAllFiles() {
    console.log("Toggle all files before");
    console.log(this.items);
    const allChecked = Array.from(this.items.values()).every(
      (item) => item.isChecked
    );
    const newState = !allChecked;
    console.log("Toggle all files after");

    // Update internal state first
    for (const [, item] of this.items) {
      // consider large files warning here?
      item.updateCheckState(newState);
    }

    console.log("Toggle all files after update");

    console.log("Toggle all files after save");

    this.invalidateWebviewPreview();

    console.log("Toggle all files after invalidate");

    // --- Token Count Update ---
    if (!newState) {
      // If toggling OFF
      this.currentTokenCalculationVersion++; // Invalidate any ongoing count *immediately*
      this.totalTokenCount = 0;
      this.isCountingTokens = false;
      this.notifyTokenUpdate(); // Instantly update UI to 0
      console.log("Token count reset to 0 (Toggled all off).");
    } else {
      // If toggling ON, trigger a debounced update
      this.debouncedUpdateTokenCount();
    }

    // Refresh the TreeView UI AFTER updating state and potentially tokens
    this._onDidChangeTreeData.fire();

    setTimeout(() => {
      console.log("Toggle all files after");
      console.log(this.items);
    }, 1000);
  }

  async toggleCheck(item: FileItem) {
    console.log(
      `[${new Date().toISOString()}] toggleCheck Triggered: Path="${
        item.filePath
      }" Type="${item.contextValue}" CurrentCheckedState=${item.isChecked}`
    );

    let newState = !item.isChecked;
    const originalState = item.isChecked; // Store original state
    let userCancelled = false;

    try {
      // Check file size only when checking ON a FILE
      if (newState && item.contextValue === "file") {
        await this.checkFileSize(item.filePath);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "User cancelled large file selection"
      ) {
        newState = false; // Force state back to unchecked
        userCancelled = true; // Flag cancellation
      }
      // Ignore other errors during checkFileSize
      console.log("ERROR:Toggle check error");
      console.log(error);
    }

    const stateEffectivelyChanged = newState !== originalState || userCancelled; // Determine if actual change occurred

    // Only proceed if the final intended state is different from the original OR user cancelled
    if (stateEffectivelyChanged) {
      item.updateCheckState(newState); // Update the item's visual state

      let childrenCancelled = false;
      if (item.contextValue === "folder") {
        // Update children state in the map. Returns true if any child was cancelled.
        childrenCancelled = await this.toggleDirectoryChildren(
          item.filePath,
          newState
        );
        console.log("Toggle check children cancelled");
      }
      // Ensure the toggled item itself is updated in the map
      this.items.set(item.filePath, item);

      // Refresh the specific item and its children visually
      this._onDidChangeTreeData.fire(item);
      console.log("Toggle check item refreshed");

      // Trigger Token Update and Invalidation only if state wasn't cancelled back to original
      // Or if children were cancelled (meaning effective selection changed)
      if (newState !== originalState || childrenCancelled) {
        this.invalidateWebviewPreview();
        this.debouncedUpdateTokenCount();
      }
    }
  }

  private async checkFileSize(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
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
      // Silently ignore other errors
    }
  }

  private async toggleDirectoryChildren(
    dirPath: string,
    checked: boolean
  ): Promise<boolean> {
    let userCancelledSomewhere = false;
    const affectedChildren: FileItem[] = []; // Track potentially affected items

    // Find all descendants in the map
    for (const item of this.items.values()) {
      if (item.filePath.startsWith(dirPath + path.sep)) {
        affectedChildren.push(item);
      }
    }

    // Process affected children (check files for size when turning ON)
    for (const item of affectedChildren) {
      let fileSpecificCancellation = false;

      // --- File Size Check (only when checking ON a FILE) ---
      if (checked && item.contextValue === "file") {
        try {
          await this.checkFileSize(item.filePath);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "User cancelled large file selection"
          ) {
            fileSpecificCancellation = true;
            userCancelledSomewhere = true;
          }
          // Ignore other stat/check errors
        }
      }

      // Update the item's state in the map
      item.updateCheckState(fileSpecificCancellation ? false : checked);
      // No need to set this.items.set(item.filePath, item) as we have the reference
    }

    // No recursion needed as we processed all descendants directly from the map
    return userCancelledSomewhere;
  }

  private loadConfig() {
    const config = vscode.workspace.getConfiguration("promptTower");

    const useGitIgnore = config.get<boolean>("useGitignore", true);
    const manualIgnores = config.get<string[]>("ignore", []);

    // Define standard ignores that are usually good defaults
    const standardIgnores = [".git", "node_modules", ".vscode", "dist", "out"];

    // Combine standard, gitignore (if enabled), and manual ignores
    this.excludedPatterns = [
      ...new Set([
        // Use Set to remove duplicates
        ...ALWAYS_IGNORE,
        ...standardIgnores,
        ...(useGitIgnore ? this.getGitIgnorePatterns() : []),
        ...this.getTowerIgnorePatterns(),
        ...manualIgnores.map((p) => p.trim()).filter((p) => p), // Trim and remove empty manual ignores
      ]),
    ];
    console.log("Prompt Tower Excluded Patterns:", this.excludedPatterns);

    this.maxFileSizeWarningKB = config.get<number>("maxFileSizeWarningKB", 500);

    const outputFormat = config.get<any>("outputFormat");
    this.blockTemplate = outputFormat?.blockTemplate ?? this.blockTemplate;
    this.blockSeparator = outputFormat?.blockSeparator ?? this.blockSeparator;

    // Load project tree settings
    const projectTreeFormat = config.get<any>("outputFormat.projectTreeFormat");
    if (projectTreeFormat) {
      this.projectTreeEnabled =
        projectTreeFormat.enabled ?? this.projectTreeEnabled;
      this.projectTreeType = projectTreeFormat.type ?? this.projectTreeType;
      this.projectTreeShowFileSize =
        projectTreeFormat.showFileSize ?? this.projectTreeShowFileSize;
    }

    const wrapperFormat = config.get<any>("outputFormat.wrapperFormat");
    if (wrapperFormat === null) {
      this.wrapperTemplate = null;
    } else {
      this.wrapperTemplate = wrapperFormat?.template ?? this.wrapperTemplate;
    }

    // NOTE: A listener for configuration changes should ideally be added
    // in extension.ts to call a method here that reloads config and refreshes.
    // For now, config is loaded on startup only.
  }

  // Placeholder for gitignore parsing logic (basic implementation)
  // TODO: Replace with a robust .gitignore parsing library if complex patterns are needed.
  private getGitIgnorePatterns(): string[] {
    const gitignorePath = path.join(this.workspaceRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        return content
          .split(/\r?\n/) // Split lines
          .map((line) => line.trim()) // Trim whitespace
          .filter((line) => line && !line.startsWith("#")); // Remove empty lines and comments
      } catch (e) {
        console.error("Error reading or parsing .gitignore:", e);
        return [];
      }
    }
    return []; // No .gitignore file found
  }

  private getTowerIgnorePatterns(): string[] {
    const towerignorePath = path.join(this.workspaceRoot, ".towerignore");
    if (fs.existsSync(towerignorePath)) {
      try {
        const content = fs.readFileSync(towerignorePath, "utf-8");
        return content
          .split(/\r?\n/) // Split lines
          .map((line) => line.trim()) // Trim whitespace
          .filter((line) => line && !line.startsWith("#")); // Remove empty lines and comments
      } catch (e) {
        console.error("Error reading or parsing .towerignore:", e);
        return [];
      }
    }
    return []; // No .towerignore file found
  }

  getCheckedFiles(): string[] {
    // Filter based on map state AND ensure file exists on disk at time of check
    return Array.from(this.items.values())
      .filter(
        (item) =>
          item.isChecked &&
          item.contextValue === "file" &&
          fs.existsSync(item.filePath)
      )
      .map((item) => item.filePath);
  }

  /**
   * Finds all files within the workspace, respecting configured exclusions.
   *
   * @returns {Promise<StructuredFilePath[]>} A promise that resolves to an array of structured file paths.
   */
  async getAllWorkspaceFilesStructured(): Promise<StructuredFilePath[]> {
    // 1. Prepare the individual exclude patterns from your list.
    //    Consider if the `p + "**"` logic is always correct.
    //    Often, just the directory name (e.g., "node_modules") is enough for findFiles exclude.
    //    Let's assume for now the patterns in excludedPatterns are already valid globs.
    const individualExcludes = this.excludedPatterns; // Use patterns directly if they are valid globs
    // Alternative if you need the trailing /** for dirs:
    // const individualExcludes = this.excludedPatterns.map((p) =>
    //   p.endsWith("/") ? p + "**/*" : p // More specific: match files *within* the dir
    // );

    // 2. Combine the standard hidden file/folder pattern with your excludes.
    const allExcludes = ["**/.*", ...individualExcludes]; // Add the hidden file pattern first

    // 3. Create the final exclusion glob string *with only one level of braces*.
    //    Handle the case where there might be no custom excludes.
    let excludeGlobPattern: string | null;
    if (allExcludes.length > 0) {
      // Join all patterns with commas inside a SINGLE set of curly braces
      excludeGlobPattern = `{${allExcludes.join(",")}}`;
    } else {
      // If somehow allExcludes is empty (unlikely with '**/.*' added),
      // provide an empty string or undefined if findFiles allows it.
      // Passing null or undefined might be better than an empty string.
      excludeGlobPattern = null; // Or null
    }

    // 4. Use the correctly formatted pattern in findFiles.
    const allFilesUris: vscode.Uri[] = await vscode.workspace.findFiles(
      "**/*", // Include pattern: find all files
      excludeGlobPattern, // Exclude pattern: correctly formatted single group
      undefined // Optional: maxResults limit
    );

    if (this.projectTreeType === "fullDirectoriesOnly") {
      const uniqueDirectoryPaths = new Set<string>();
      allFilesUris.map((uri) => {
        // Get the directory containing the file
        const dirPath = path.dirname(uri.fsPath);
        uniqueDirectoryPaths.add(dirPath);
      });

      const structuredDirectories: StructuredFilePath[] = Array.from(
        uniqueDirectoryPaths
      )
        .map((absolutePath) => {
          const relativePath =
            path.relative(this.workspaceRoot, absolutePath) || "."; // Use '.' for root itself
          return {
            origin: absolutePath + "/",
            tree: relativePath + "/",
          };
        })
        .sort((a, b) => a.tree.localeCompare(b.tree)); // Optional: sort for consistency

      return structuredDirectories;
    }

    // Map the results (vscode.Uri objects) to your desired StructuredFilePath format
    const structuredFiles: StructuredFilePath[] = allFilesUris.map((uri) => {
      const absolutePath = uri.fsPath; // Get the absolute file system path
      const relativePath = path.relative(this.workspaceRoot, absolutePath);
      return {
        origin: absolutePath,
        tree: relativePath,
      };
    });

    return structuredFiles;
  }

  /**
   * Generates an array of objects representing selected files,
   * including their absolute path ('origin') and relative path ('tree').
   *
   * @returns {StructuredFilePath[]} An array of objects for selected files.
   */
  getSelectedFilePathsStructured(): StructuredFilePath[] {
    // Use Array.from to convert map values to an array, then filter and map
    console.log(this.items);
    return Array.from(this.items.values())
      .filter(
        (item) =>
          // only show selected files, otherwise a full tree is shown
          item.isChecked &&
          item.contextValue === "file" && // 2. Must be a file (not a folder)
          fs.existsSync(item.filePath) // 3. Must still exist on disk (robustness check)
      )
      .map((item) => {
        // For each valid item, create the desired object structure
        const originPath = item.filePath; // Absolute path
        const relativePath = path.relative(this.workspaceRoot, item.filePath); // Path relative to workspace

        return {
          origin: originPath,
          tree: relativePath,
        };
      });
  }

  // Basic pattern matching (for excludes).
  // TODO: Replace with a proper library like 'ignore' for full gitignore syntax support.
  private matchesPattern(fileName: string, pattern: string): boolean {
    if (!pattern) {
      return false;
    }

    // Simple exact match
    if (fileName === pattern) {
      return true;
    }

    // Simple folder match (e.g., "node_modules/")
    if (pattern.endsWith("/") && fileName === pattern.slice(0, -1)) {
      return true;
    }

    // Basic wildcard support (e.g., *.log) - limited
    if (pattern.startsWith("*.")) {
      return fileName.endsWith(pattern.substring(1));
    }

    // Add more basic cases if needed, but recommend a library.
    return false;
  }

  private async generateFileTree(): Promise<string> {
    // Decide whether to use selected files or ALL files based on config or needs
    let filesToInclude: StructuredFilePath[];
    if (this.projectTreeType === "selectedFilesOnly") {
      // Use the existing method for selected files (relies on this.items)
      filesToInclude = this.getSelectedFilePathsStructured();
    } else {
      // e.g., projectTreeType === 'full' or similar
      // Use the new method to get ALL workspace files
      filesToInclude = await this.getAllWorkspaceFilesStructured();
    }

    return this.projectTreeEnabled
      ? generateFileStructureTree(
          this.workspaceRoot,
          filesToInclude,
          undefined, // Default print lines limit
          {
            showFileSize:
              this.projectTreeType === "fullDirectoriesOnly"
                ? false
                : this.projectTreeShowFileSize,
          }
        )
      : Promise.resolve("");
  }

  public async generateContextString(): Promise<{
    contextString: string;
    fileCount: number;
  }> {
    const checkedFiles = this.getCheckedFiles();
    const fileCount = checkedFiles.length;

    // Keep the initial check for no files/prefix/suffix, but change return
    if (fileCount === 0) {
      console.log("Project Tree Type:", this.projectTreeType);
      // vscode.window.showWarningMessage( ... ); // Remove this warning for now, handle in caller
      if (
        this.projectTreeEnabled &&
        (this.projectTreeType === "fullFilesAndDirectories" ||
          this.projectTreeType === "fullDirectoriesOnly")
      ) {
        const fileTree = await this.generateFileTree();
        let treeBlockOnlyContext = this.projectTreeTemplate.replace(
          "{projectTree}",
          fileTree
        );
        if (this.promptPrefix) {
          treeBlockOnlyContext =
            this.promptPrefix + "\n" + treeBlockOnlyContext;
        }
        if (this.promptSuffix) {
          treeBlockOnlyContext =
            treeBlockOnlyContext + "\n" + this.promptSuffix;
        }
        return { contextString: treeBlockOnlyContext, fileCount: 0 };
      }
      return { contextString: "", fileCount: 0 };
    }

    try {
      // Process each checked file concurrently using the blockTemplate
      const fileBlockPromises = checkedFiles.map(async (fullFilePath) => {
        // Calculate necessary paths and names
        const relativePath = path.relative(this.workspaceRoot, fullFilePath); // e.g., src/database.js
        const fileNameWithExtension = path.basename(fullFilePath);
        const fileExtension = path.extname(fullFilePath);
        const fileName = path.basename(fullFilePath, fileExtension);

        // Read file content
        const fileContent = await fs.promises.readFile(fullFilePath, "utf8");

        // --- Apply Block Template Placeholders ---
        let formattedBlock = this.blockTemplate;

        // Ensure relativePath starts with '/' if needed for the <source> tag
        const sourcePath = "/" + relativePath.replace(/\\/g, "/"); // Ensure forward slashes and leading slash

        formattedBlock = formattedBlock.replace(
          /{fileNameWithExtension}/g,
          fileNameWithExtension
        );
        // Replace {rawFilePath} with the calculated relative path (with leading slash)
        formattedBlock = formattedBlock.replace(/{rawFilePath}/g, sourcePath);

        // Other placeholders (if they exist in your actual template - some are not in the default)
        // formattedBlock = formattedBlock.replace(/{filePath}/g, commentedFilePath); // REMOVE or keep ONLY if you ALSO use {filePath}
        formattedBlock = formattedBlock.replace(/{fileName}/g, fileName);
        formattedBlock = formattedBlock.replace(
          /{fileExtension}/g,
          fileExtension
        );
        formattedBlock = formattedBlock.replace(/{fullPath}/g, fullFilePath); // Keep if {fullPath} is ever used

        // @TODO: probably needs to be a config option
        // Remove all leading blank lines:
        let trimmedFileContent = fileContent.replace(/^(\s*\r?\n)+/, "");

        // Remove all trailing blank lines:
        trimmedFileContent = fileContent.replace(/(\r?\n\s*)+$/, "");

        // Replace fileContent last to avoid issues if content contains placeholders
        formattedBlock = formattedBlock.replace(
          /{fileContent}/g,
          trimmedFileContent
        );

        return formattedBlock;
      });

      const fileTreePromise = this.generateFileTree();

      // Wait for all file processing to complete
      // const contents = await Promise.all(fileBlockPromises);

      // Wait for all file processing to complete, including the file tree
      const allPromises = [fileTreePromise, ...fileBlockPromises];
      const results = await Promise.all(allPromises);

      // Now the file tree is at index 0, and the file blocks start at index 1
      const fileTree = results[0];
      const contents = results.slice(1);

      // --- Join the processed blocks ---
      const joinedBlocks = contents.join(this.blockSeparator);

      // --- Apply the Wrapper Template (if enabled) ---
      let combinedBlocksAndWrapper: string;
      if (this.wrapperTemplate) {
        combinedBlocksAndWrapper = this.wrapperTemplate; // Start with the wrapper template

        const treeBlock = this.projectTreeEnabled
          ? this.projectTreeTemplate.replace("{projectTree}", fileTree)
          : "";

        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          "{treeBlock}",
          treeBlock
        );

        // Calculate values needed for wrapper placeholders
        const timestamp = new Date().toISOString(); // Use ISO format

        // Replace placeholders in the wrapper template
        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          /{blocks}/g,
          joinedBlocks
        );
        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          /{timestamp}/g,
          timestamp
        );
        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          /{fileCount}/g,
          String(fileCount)
        );
        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          /{workspaceRoot}/g,
          this.workspaceRoot
        );
        combinedBlocksAndWrapper = combinedBlocksAndWrapper.replace(
          /{outputFileName}/g,
          "clipboard-content" // Use a generic filename since we're not creating a file
        );
      } else {
        // No wrapper template defined, use joined blocks directly
        combinedBlocksAndWrapper = joinedBlocks;
      }

      let finalOutput = "";

      if (this.promptPrefix) {
        finalOutput += this.promptPrefix + "\n"; // Add prefix with newline
      }

      finalOutput += combinedBlocksAndWrapper; // Add the (potentially wrapped) file blocks

      if (this.promptSuffix) {
        // Add a newline before the suffix *if* there was prefix or file content already
        if (finalOutput.length > 0 && !finalOutput.endsWith("\n")) {
          finalOutput += "\n";
        }
        finalOutput += this.promptSuffix; // Add suffix
      }

      return { contextString: finalOutput, fileCount: fileCount };
    } catch (error) {
      // Convert the error to a string message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Throw the error again to be handled by the caller
      throw new Error(`Error generating context string: ${errorMessage}`);
    }
  }

  async copyContextToClipboard() {
    try {
      // Call the refactored helper method
      const { contextString, fileCount } = await this.generateContextString();

      // Handle empty case
      if (fileCount === 0 && !contextString) {
        vscode.window.showWarningMessage(
          "No files selected or prefix/suffix entered to copy!"
        );
        return;
      }

      // Copy to clipboard
      await vscode.env.clipboard.writeText(contextString);

      // Get the most recently calculated token count for the message
      const tokenCount = this.totalTokenCount;

      // Show success message
      vscode.window.showInformationMessage(
        `Success: Copied context for ${fileCount} files (${tokenCount.toLocaleString()} tokens) to clipboard.`
      );
    } catch (error) {
      // Handle errors during the process
      vscode.window.showErrorMessage(
        `Error copying context to clipboard: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      console.error("Error copying context:", error);
    }
  }

  private setupIgnoreFileWatchers(): void {
    // Create watchers for both files even if they don't exist yet
    const gitignoreWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, ".gitignore")
    );

    const towerignoreWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, ".towerignore")
    );

    // Define a common async handler function for all ignore file events
    const handleIgnoreFileChange = async (
      fileName: string,
      eventType: string
    ) => {
      // Log the detection clearly
      console.log(
        `Detected ${eventType} in ${fileName}, reloading patterns and rebuilding item list...`
      );

      try {
        const previouslyCheckedPaths = new Set<string>();
        for (const item of this.items.values()) {
          if (item.isChecked) {
            previouslyCheckedPaths.add(item.filePath);
          }
        }
        console.log(`Remembered ${previouslyCheckedPaths.size} checked paths.`);

        // Step 1: Load the updated configuration (updates this.excludedPatterns)
        this.loadConfig();
        console.log(`${fileName} ${eventType}: loadConfig completed.`);

        // Step 2: Re-initialize the entire item map based on the new patterns
        // This is the crucial step to add/remove items from the internal list
        await this.initializeWorkspaceItems(previouslyCheckedPaths); // Pass the set
        console.log(
          `${fileName} ${eventType}: initializeWorkspaceItems completed.`
        );

        // Step 3: Signal VS Code to refresh the Tree View UI
        this._onDidChangeTreeData.fire(); // Full refresh based on new items map
        console.log(`${fileName} ${eventType}: Fired TreeDataChanged.`);

        // Step 4: Recalculate token count as the available/visible items may have changed
        this.debouncedUpdateTokenCount();
        console.log(`${fileName} ${eventType}: Triggered token count update.`);
      } catch (error) {
        // Log any errors during the process and notify the user
        console.error(`Error handling ${fileName} ${eventType}:`, error);
        vscode.window.showErrorMessage(
          `Failed to process changes in ${fileName}. Check Developer Tools Console.`
        );
      }
    };

    // --- Register Watcher Callbacks ---

    // Handle file changes for .gitignore
    gitignoreWatcher.onDidChange(() =>
      handleIgnoreFileChange(".gitignore", "change")
    );
    gitignoreWatcher.onDidCreate(() =>
      handleIgnoreFileChange(".gitignore", "create")
    );
    gitignoreWatcher.onDidDelete(() =>
      handleIgnoreFileChange(".gitignore", "delete")
    ); // Also reload on delete

    // Handle file changes for .towerignore
    towerignoreWatcher.onDidChange(() =>
      handleIgnoreFileChange(".towerignore", "change")
    );
    towerignoreWatcher.onDidCreate(() =>
      handleIgnoreFileChange(".towerignore", "create")
    );
    towerignoreWatcher.onDidDelete(() =>
      handleIgnoreFileChange(".towerignore", "delete")
    ); // Also reload on delete

    // Add watchers to context subscriptions for proper disposal when the extension deactivates
    this.context.subscriptions.push(gitignoreWatcher, towerignoreWatcher);
  }
}
