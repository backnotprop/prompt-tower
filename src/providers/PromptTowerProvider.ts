import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileItem } from "../models/FileItem";
import { encode } from "gpt-tokenizer";
import { TokenUpdateEmitter } from "../models/EventEmitter";

import { generateFileStructureTree } from "../utils/fileTree";

interface StructuredFilePath {
  origin: string; // Absolute path on disk
  tree: string; // Path relative to the workspace root
}

/**
 * @TODO
 * - config listeners
 * - promptTower.useGitignore: This is the major missing piece.
 *   - We need to add logic to read this setting, parse .gitignore files,
 *   - and integrate those patterns (using a proper matching library) with the promptTower.ignore setting.
 * - "format path as comment" (need config and implementation)
 */

export class PromptTowerProvider implements vscode.TreeDataProvider<FileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FileItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private items = new Map<string, FileItem>();
  private excludedPatterns: string[] = [];
  private persistState: boolean = true;
  private maxFileSizeWarningKB: number = 500;

  private blockTemplate: string =
    '<file name="{fileNameWithExtension}" path="{rawFilePath}">\n{fileContent}\n</file>';
  private blockSeparator: string = "\n";
  private outputExtension: string = "txt";
  private wrapperTemplate: string | null =
    "<context>\n<project_files>\n{blocks}\n</project_files>\n</context>";

  // --- Token Counting State ---
  private totalTokenCount: number = 0;
  private isCountingTokens: boolean = false;
  private currentTokenCalculationVersion = 0; // For cancellation

  private promptPrefix: string = "";
  private promptSuffix: string = "";

  private invalidateWebviewPreview: () => void;

  constructor(
    private workspaceRoot: string,
    private context: vscode.ExtensionContext,
    private tokenUpdateEmitter: TokenUpdateEmitter,
    invalidateWebviewPreview: () => void
  ) {
    this.invalidateWebviewPreview = invalidateWebviewPreview;
    this.loadConfig();
    this.loadPersistedState();
    this.debouncedUpdateTokenCount(100); // Initial count calculation (debounced slightly)
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

    try {
      // Check if path exists and is a directory before reading
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        console.warn(
          `getChildren called on non-existent or non-directory path: ${dirPath}`
        );
        // If the element itself is invalid, remove it from the map?
        if (element) {
          this.items.delete(element.filePath);
        }
        return [];
      }

      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });
      const children: FileItem[] = [];

      for (const entry of entries) {
        // Apply exclusion patterns defined in loadConfig
        if (
          this.excludedPatterns.some((pattern) =>
            this.matchesPattern(entry.name, pattern)
          )
        ) {
          continue;
        }

        const filePath = path.join(dirPath, entry.name);
        let item = this.items.get(filePath); // Check if we already know about this item

        if (!item) {
          // Item not in map - must be newly discovered
          const isDirectory = entry.isDirectory();
          item = new FileItem(
            entry.name,
            isDirectory
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            filePath,
            // Check parent state ONLY if parent (element) exists and is checked
            // Default to false otherwise. This handles root items and children of unchecked folders.
            element?.isChecked ?? false
          );
          // Add newly discovered items to the map, inheriting checked state from parent (if applicable)
          this.items.set(filePath, item);
          // Should newly discovered items under a checked folder trigger a token recount?
          // Let's say yes, as the effective context changed.
          if (item.isChecked) {
            this.debouncedUpdateTokenCount();
          }
        } else {
          // Item exists in map - update its properties based on file system info
          // but KEEP its existing isChecked state from the map.
          // Create a new item instead of modifying read-only properties
          const isDirectory = entry.isDirectory();
          const newItem = new FileItem(
            entry.name,
            isDirectory
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            filePath,
            item.isChecked // Keep the existing checked state
          );
          // Copy any other properties as needed
          newItem.tooltip = filePath;
          newItem.description = entry.isFile()
            ? path.extname(filePath)
            : undefined;
          // Replace the item in the map
          this.items.set(filePath, newItem);
          // Update reference for the children array
          item = newItem;
        }
        children.push(item);
      }

      // --- Sorting ---
      children.sort((a, b) => {
        // Folders before files
        const aIsFolder =
          a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        const bIsFolder =
          b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        if (aIsFolder !== bIsFolder) {
          return aIsFolder ? -1 : 1;
        }
        // Then sort alphabetically by label
        return a.label.localeCompare(b.label);
      });

      return children;
    } catch (error: any) {
      // Avoid spamming errors for common issues like permission denied
      if (
        error.code !== "EACCES" &&
        error.code !== "EPERM" &&
        error.code !== "ENOENT"
      ) {
        console.error(
          `Error reading directory for getChildren: ${dirPath}`,
          error
        );
        vscode.window.showErrorMessage(
          `Cannot read directory: ${path.basename(dirPath)}`
        );
      } else if (error.code === "ENOENT" && element) {
        // If the element directory itself doesn't exist, remove it from map
        this.items.delete(element.filePath);
        this.savePersistedState(); // Persist the removal
      }
      return []; // Return empty list on error
    }
  }

  refresh(): void {
    this.items.clear();
    this.loadPersistedState(); // Loads state, potentially changing checked items
    this._onDidChangeTreeData.fire(); // Update the tree view itself
    this.debouncedUpdateTokenCount(); // Recalculate tokens after refresh completes
    this.invalidateWebviewPreview();
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

    if (this.persistState) {
      this.savePersistedState();
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
    const allChecked = Array.from(this.items.values()).every(
      (item) => item.isChecked
    );
    const newState = !allChecked;

    // Update internal state first
    for (const [, item] of this.items) {
      // consider large files warning here?
      item.updateCheckState(newState);
    }

    if (this.persistState) {
      this.savePersistedState();
    }

    this.invalidateWebviewPreview();

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
  }

  // Add back the missing toggleCheck method
  async toggleCheck(item: FileItem) {
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
      }
      // Ensure the toggled item itself is updated in the map
      this.items.set(item.filePath, item);

      this.savePersistedState();

      // Refresh the specific item and its children visually
      this._onDidChangeTreeData.fire(item);

      // Trigger Token Update and Invalidation only if state wasn't cancelled back to original
      // Or if children were cancelled (meaning effective selection changed)
      if (newState !== originalState || childrenCancelled) {
        this.invalidateWebviewPreview();
        this.debouncedUpdateTokenCount();
      }
    }
  }

  // Add back the needed helper method for toggleCheck
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

  // Add back the missing toggleDirectoryChildren method
  private async toggleDirectoryChildren(
    dirPath: string,
    checked: boolean
  ): Promise<boolean> {
    let userCancelledSomewhere = false; // Track if cancellation happened in this branch

    try {
      // Check if directory exists before reading
      if (!fs.existsSync(dirPath)) {
        console.warn(
          `Directory not found in toggleDirectoryChildren: ${dirPath}`
        );
        return false;
      }
      // Ensure it's actually a directory
      if (!fs.statSync(dirPath).isDirectory()) {
        console.warn(
          `Path is not a directory in toggleDirectoryChildren: ${dirPath}`
        );
        return false;
      }

      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        // Apply exclusion patterns
        if (
          this.excludedPatterns.some((pattern) =>
            this.matchesPattern(entry.name, pattern)
          )
        ) {
          continue;
        }

        const filePath = path.join(dirPath, entry.name);
        let fileSpecificCancellation = false; // Was this specific file cancelled?

        // --- File Size Check (only when checking ON a FILE) ---
        if (checked && entry.isFile()) {
          try {
            await this.checkFileSize(filePath);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "User cancelled large file selection"
            ) {
              fileSpecificCancellation = true; // Mark this file as cancelled by user
              userCancelledSomewhere = true; // Mark that cancellation occurred in this subtree
              // Do NOT continue; we need to process this item below to ensure it's unchecked.
            }
            // Ignore other stat/check errors, proceed as if not cancelled
          }
        }

        // --- Find or Create Item ---
        let item = this.items.get(filePath);
        if (!item) {
          // If item doesn't exist (e.g., new file since last refresh), create it
          item = new FileItem(
            entry.name,
            entry.isDirectory()
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            filePath,
            // Initial state is the target state *unless* user cancelled this specific file
            fileSpecificCancellation ? false : checked
          );
          this.items.set(filePath, item); // Add to map
        } else {
          // If item exists, update its check state based on target state and cancellation
          item.updateCheckState(fileSpecificCancellation ? false : checked);
          // Ensure the potentially updated item is in the map (redundant if get returned reference, but safe)
          this.items.set(filePath, item);
        }

        // --- Recurse for Directories ---
        if (entry.isDirectory()) {
          // Recursively toggle children and bubble up cancellation status
          const childCancelled = await this.toggleDirectoryChildren(
            filePath,
            checked
          );
          if (childCancelled) {
            // If any descendant was cancelled, mark this branch as cancelled
            userCancelledSomewhere = true;
          }
        }
      } // End for loop
    } catch (error: any) {
      // Log errors but don't prevent processing other items typically
      if (error.code === "EACCES" || error.code === "EPERM") {
        console.warn(
          `Permission error toggling directory children: ${dirPath}`
        );
      } else if (error.code !== "ENOENT") {
        // Ignore 'file not found' if dir deleted during process
        console.error(`Error processing directory children: ${dirPath}`, error);
      }
    }
    // Return whether cancellation happened at this level or below
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
        ...standardIgnores,
        ...(useGitIgnore ? this.getGitIgnorePatterns() : []),
        ...manualIgnores.map((p) => p.trim()).filter((p) => p), // Trim and remove empty manual ignores
      ]),
    ];
    console.log("Prompt Tower Excluded Patterns:", this.excludedPatterns);

    this.persistState = config.get<boolean>("persistState", true);
    this.maxFileSizeWarningKB = config.get<number>("maxFileSizeWarningKB", 500);

    const outputFormat = config.get<any>("outputFormat");
    this.blockTemplate = outputFormat?.blockTemplate ?? this.blockTemplate;
    this.blockSeparator = outputFormat?.blockSeparator ?? this.blockSeparator;
    this.outputExtension =
      outputFormat?.outputExtension ?? this.outputExtension;

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

  private loadPersistedState() {
    if (!this.persistState) {
      this.items.clear(); // Clear items if persistence is off
      console.log("Prompt Tower: State persistence is disabled.");
      return;
    }

    const state =
      this.context.globalState.get<Record<string, boolean>>("fileStates");
    this.items.clear(); // Clear current items before loading persisted ones

    if (state) {
      console.log(
        `Prompt Tower: Loading ${
          Object.keys(state).length
        } persisted file states.`
      );
      let loadedCount = 0;
      for (const [filePath, isChecked] of Object.entries(state)) {
        // IMPORTANT: Check if the file/folder still exists before creating an item
        if (fs.existsSync(filePath)) {
          try {
            const stats = fs.statSync(filePath); // Use sync here as it's part of init
            const isDirectory = stats.isDirectory();
            // Create the item based on persisted state
            const item = new FileItem(
              path.basename(filePath),
              isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
              filePath,
              isChecked // Use the persisted checked state
            );
            // Add to the internal map
            this.items.set(filePath, item);
            loadedCount++;
          } catch (e) {
            // Error stating file (permissions?), log and skip
            console.error(`Error stating persisted file ${filePath}:`, e);
          }
        } else {
          // File/folder from state no longer exists, don't load it into `items`
          console.log(
            `Prompt Tower: Persisted item no longer exists, skipping: ${filePath}`
          );
          // Optionally, clean up the persisted state itself here by removing the entry?
          // delete state[filePath]; // Requires updating globalState again later
        }
      }
      console.log(
        `Prompt Tower: Successfully loaded state for ${loadedCount} existing items.`
      );
      // If you implement state cleanup:
      // this.context.globalState.update("fileStates", state);
    } else {
      console.log("Prompt Tower: No persisted state found.");
    }
    // DO NOT trigger token update here. The constructor calls it *after* this method runs.
  }

  private savePersistedState() {
    if (!this.persistState) {
      // If persistence was turned off, ensure the stored state is cleared.
      this.context.globalState.update("fileStates", undefined);
      return;
    }

    const state: Record<string, boolean> = {};
    let persistedCount = 0;
    // Iterate over the *current* items in the map
    this.items.forEach((item, filePath) => {
      // Persist state ONLY if the item still exists on disk
      // This prevents persisting state for items deleted during the session
      if (fs.existsSync(filePath)) {
        state[filePath] = item.isChecked;
        persistedCount++;
      }
    });

    // Update the global state
    this.context.globalState.update("fileStates", state);
    // console.log(`Prompt Tower: Saved state for ${persistedCount} items.`); // Optional log
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
   * Generates an array of objects representing selected files,
   * including their absolute path ('origin') and relative path ('tree').
   *
   * @returns {StructuredFilePath[]} An array of objects for selected files.
   */
  getSelectedFilePathsStructured(): StructuredFilePath[] {
    // Use Array.from to convert map values to an array, then filter and map
    return Array.from(this.items.values())
      .filter(
        (item) =>
          item.isChecked && // 1. Must be checked/selected
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

  public async generateContextString(): Promise<{
    contextString: string;
    fileCount: number;
  }> {
    const checkedFiles = this.getCheckedFiles();
    const fileCount = checkedFiles.length;

    // Keep the initial check for no files/prefix/suffix, but change return
    if (fileCount === 0 && !this.promptPrefix && !this.promptSuffix) {
      // vscode.window.showWarningMessage( ... ); // Remove this warning for now, handle in caller
      // return; // Remove this return
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

        // Replace fileContent last to avoid issues if content contains placeholders
        formattedBlock = formattedBlock.replace(/{fileContent}/g, fileContent);

        return formattedBlock;
      });

      const structuredFilePaths = this.getSelectedFilePathsStructured();
      const fileTreePromise = generateFileStructureTree(
        this.workspaceRoot,
        structuredFilePaths
      );

      // Wait for all file processing to complete
      // const contents = await Promise.all(fileBlockPromises);

      // Wait for all file processing to complete, including the file tree
      const allPromises = [fileTreePromise, ...fileBlockPromises];
      const results = await Promise.all(allPromises);

      // Now the file tree is at index 0, and the file blocks start at index 1
      const fileTree = results[0];
      const _contents = results.slice(1);

      // If you need to put them all together with fileTree at the beginning
      const contents = [fileTree, ..._contents];

      // --- Join the processed blocks ---
      const joinedBlocks = contents.join(this.blockSeparator);

      // --- Apply the Wrapper Template (if enabled) ---
      let combinedBlocksAndWrapper: string;
      if (this.wrapperTemplate) {
        combinedBlocksAndWrapper = this.wrapperTemplate; // Start with the wrapper template

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
}
