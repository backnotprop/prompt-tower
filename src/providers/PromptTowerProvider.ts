// src/providers/PromptTowerProvider.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileItem } from "../models/FileItem";

/**
 * @TODO
 * - config listeners
 * - promptTower.useGitignore: This is the major missing piece. You need to add logic to read this setting, parse .gitignore files, and integrate those patterns (using a proper matching library) with the promptTower.ignore setting.
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
    '<file name="{fileNameWithExtension}">\n<source>{rawFilePath}</source>\n<file_content><![CDATA[\n{fileContent}\n]]>\n</file_content>\n</file>';
  private blockSeparator: string = "\n";
  private outputExtension: string = "txt";
  private wrapperTemplate: string | null =
    "<context>\n<files>\n{blocks}\n</files>\n</context>";

  constructor(
    private workspaceRoot: string,
    private context: vscode.ExtensionContext
  ) {
    this.loadConfig();
    this.loadPersistedState();
  }

  // Required by TreeDataProvider interface
  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  // Required by TreeDataProvider interface
  async getChildren(element?: FileItem): Promise<FileItem[]> {
    if (element) {
      return this.getDirectoryItems(element.filePath);
    }
    return this.getDirectoryItems(this.workspaceRoot);
  }

  refresh(): void {
    this.items.clear();
    this.loadPersistedState();
    this._onDidChangeTreeData.fire();
  }

  async toggleAllFiles() {
    const allChecked = Array.from(this.items.values()).every(
      (item) => item.isChecked
    );
    const newState = !allChecked;

    for (const [, item] of this.items) {
      item.updateCheckState(newState);
    }

    if (this.persistState) {
      this.savePersistedState();
    }
    this.refresh();
  }

  private loadConfig() {
    const config = vscode.workspace.getConfiguration("promptTower");

    // Load general settings (assuming 'ignore' is the correct key from package.json)
    this.excludedPatterns = config.get<string[]>("ignore", []);
    // Optional: You might want to ensure common ignores are always present
    // if (!this.excludedPatterns.includes('.git')) { this.excludedPatterns.push('.git'); }
    // if (!this.excludedPatterns.includes('node_modules')) { this.excludedPatterns.push('node_modules'); }

    this.persistState = config.get<boolean>("persistState", true);
    this.maxFileSizeWarningKB = config.get<number>("maxFileSizeWarningKB", 500);

    // Load the new output format settings from the 'outputFormat' object
    const outputFormat = config.get<any>("outputFormat"); // Get the whole object

    // Use defaults defined in class properties if config values are missing
    this.blockTemplate = outputFormat?.blockTemplate ?? this.blockTemplate;
    this.blockSeparator = outputFormat?.blockSeparator ?? this.blockSeparator;
    this.outputExtension =
      outputFormat?.outputExtension ?? this.outputExtension;

    // Load Wrapper Format - handles object or null
    const wrapperFormat = config.get<any>("outputFormat.wrapperFormat"); // Read the whole object/null value

    if (wrapperFormat === null) {
      this.wrapperTemplate = null;
    } else {
      // Use template from config, or the class default if config value is undefined/null
      this.wrapperTemplate = wrapperFormat?.template ?? this.wrapperTemplate;
    }

    // TODO: We might want to add a listener for configuration changes
    // vscode.workspace.onDidChangeConfiguration(e => { ... this.loadConfig(); this.refresh(); ... });
  }

  private loadPersistedState() {
    if (!this.persistState) {
      this.items.clear(); // Clear items if persistence is off
      return;
    }
    // Clear current items before loading persisted ones to reflect reality
    this.items.clear();
    const state =
      this.context.globalState.get<Record<string, boolean>>("fileStates");
    if (state) {
      for (const [filePath, isChecked] of Object.entries(state)) {
        // Check if file still exists before creating an item
        if (fs.existsSync(filePath)) {
          try {
            const stats = fs.statSync(filePath);
            this.items.set(
              filePath,
              new FileItem(
                path.basename(filePath),
                stats.isDirectory()
                  ? vscode.TreeItemCollapsibleState.Collapsed
                  : vscode.TreeItemCollapsibleState.None,
                filePath,
                isChecked
              )
            );
          } catch (e) {
            console.error(`Error stating file ${filePath}:`, e);
            // Optionally remove invalid state entry
            // delete state[filePath];
            // this.context.globalState.update("fileStates", state);
          }
        }
        // Consider removing state for files that no longer exist
        // else { delete state[filePath]; this.context.globalState.update("fileStates", state); }
      }
    }
  }

  private savePersistedState() {
    if (!this.persistState) {
      this.context.globalState.update("fileStates", undefined);
      return;
    }

    const state: Record<string, boolean> = {};
    // Ensure only valid items are persisted
    this.items.forEach((item, filePath) => {
      // Check existence? Or assume items map is already clean.
      // Let's assume items map only contains valid paths for now.
      state[filePath] = item.isChecked;
    });
    this.context.globalState.update("fileStates", state);
  }

  private async getDirectoryItems(dirPath: string): Promise<FileItem[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });
      const result = await Promise.all(
        entries
          .filter((entry) => !this.excludedPatterns.includes(entry.name))
          .map(async (entry) => {
            const filePath = path.join(dirPath, entry.name);
            const isDirectory = entry.isDirectory();

            let item = this.items.get(filePath);
            if (!item) {
              item = new FileItem(
                entry.name,
                isDirectory
                  ? vscode.TreeItemCollapsibleState.Collapsed
                  : vscode.TreeItemCollapsibleState.None,
                filePath,
                this.items.get(filePath)?.isChecked ?? false
              );
              this.items.set(filePath, item);
            }
            return item;
          })
      );

      return result;
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading directory: ${dirPath}`);
      return [];
    }
  }

  async toggleCheck(item: FileItem) {
    let newState = !item.isChecked;

    try {
      // Check file size if checking a file
      if (newState && item.contextValue === "file") {
        await this.checkFileSize(item.filePath);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "User cancelled large file selection"
      ) {
        newState = false;
      }
    }

    item.updateCheckState(newState);

    if (item.contextValue === "folder") {
      await this.toggleDirectoryChildren(item.filePath, newState);
    }

    this.savePersistedState();
    this.refresh();
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

  private async toggleDirectoryChildren(dirPath: string, checked: boolean) {
    try {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (this.excludedPatterns.includes(entry.name)) {
          continue;
        }

        const filePath = path.join(dirPath, entry.name);
        const item =
          this.items.get(filePath) ||
          new FileItem(
            entry.name,
            entry.isDirectory()
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            filePath,
            checked
          );

        // Check file size if checking a file
        if (checked && entry.isFile()) {
          try {
            await this.checkFileSize(filePath);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "User cancelled large file selection"
            ) {
              continue; // Skip this file but continue with others
            }
          }
        }

        item.updateCheckState(checked);
        this.items.set(filePath, item);

        if (entry.isDirectory()) {
          await this.toggleDirectoryChildren(filePath, checked);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error toggling directory: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  getCheckedFiles(): string[] {
    return Array.from(this.items.values())
      .filter((item) => item.isChecked && item.contextValue === "file")
      .map((item) => item.filePath);
  }

  async generateFile() {
    const checkedFiles = this.getCheckedFiles();
    if (checkedFiles.length === 0) {
      vscode.window.showWarningMessage("No files selected!");
      return;
    }
    // Get file count early for potential use in wrapper
    const fileCount = checkedFiles.length;

    const fileNameRaw = // Use separate variable for input name
      (await vscode.window.showInputBox({
        prompt: "Enter output file name (without extension)",
        placeHolder: "context",
        validateInput: (value) =>
          value?.includes(".") ? "No extensions allowed" : null,
      })) || "context";

    try {
      // Prepare final filename and path using configured extension
      const outputFileNameWithExtension = `${fileNameRaw}.${this.outputExtension}`;
      const outputPath = path.join(
        this.workspaceRoot,
        outputFileNameWithExtension
      );

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

        // *** FIX START ***
        // Ensure relativePath starts with '/' if needed for the <source> tag
        const sourcePath = "/" + relativePath.replace(/\\/g, "/"); // Ensure forward slashes and leading slash

        formattedBlock = formattedBlock.replace(
          /{fileNameWithExtension}/g,
          fileNameWithExtension
        );
        // Replace {rawFilePath} with the calculated relative path (with leading slash)
        formattedBlock = formattedBlock.replace(/{rawFilePath}/g, sourcePath);
        // *** FIX END ***

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

      // Wait for all file processing to complete
      const contents = await Promise.all(fileBlockPromises);

      // --- Join the processed blocks ---
      const joinedBlocks = contents.join(this.blockSeparator);

      // --- Apply the Wrapper Template (if enabled) ---
      let finalOutput: string;
      if (this.wrapperTemplate) {
        finalOutput = this.wrapperTemplate; // Start with the wrapper template

        // Calculate values needed for wrapper placeholders
        const timestamp = new Date().toISOString(); // Use ISO format

        // Replace placeholders in the wrapper template
        finalOutput = finalOutput.replace(/{blocks}/g, joinedBlocks);
        finalOutput = finalOutput.replace(/{timestamp}/g, timestamp);
        finalOutput = finalOutput.replace(/{fileCount}/g, String(fileCount));
        finalOutput = finalOutput.replace(
          /{workspaceRoot}/g,
          this.workspaceRoot
        );
        finalOutput = finalOutput.replace(
          /{outputFileName}/g,
          outputFileNameWithExtension
        );
      } else {
        // No wrapper template defined, use joined blocks directly
        finalOutput = joinedBlocks;
      }

      // --- Write the final combined output ---
      await fs.promises.writeFile(outputPath, finalOutput);

      // --- Open the generated file ---
      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      // Standard error handling
      vscode.window.showErrorMessage(
        `Error generating file: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}
