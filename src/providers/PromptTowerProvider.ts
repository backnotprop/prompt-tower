// src/providers/PromptTowerProvider.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileItem } from "../models/FileItem";

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
  private outputFormat = {
    fileHeaderFormat: "// File: {filePath}",
    fileSeparator: "\n\n",
    extension: "txt",
  };
  private searchPattern: string = "";

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

  setSearchPattern(pattern: string): void {
    this.searchPattern = pattern;
    this.refresh();
  }

  async toggleAllFiles() {
    const allChecked = Array.from(this.items.values()).every(
      (item) => item.isChecked
    );
    const newState = !allChecked;

    for (const [path, item] of this.items) {
      item.updateCheckState(newState);
    }

    if (this.persistState) {
      this.savePersistedState();
    }
    this.refresh();
  }

  private loadConfig() {
    const config = vscode.workspace.getConfiguration("promptTower");
    this.excludedPatterns = config.get<string[]>("exclude", [
      "node_modules",
      ".git",
    ]);
    this.persistState = config.get<boolean>("persistState", true);
    this.maxFileSizeWarningKB = config.get<number>("maxFileSizeWarningKB", 500);

    const outputFormat = config.get<any>("outputFormat", {});
    this.outputFormat = {
      fileHeaderFormat: outputFormat.fileHeaderFormat || "// File: {filePath}",
      fileSeparator: outputFormat.fileSeparator || "\n\n",
      extension: outputFormat.extension || "txt",
    };
  }

  private loadPersistedState() {
    if (!this.persistState) return;

    const state =
      this.context.globalState.get<Record<string, boolean>>("fileStates");
    if (state) {
      for (const [filePath, isChecked] of Object.entries(state)) {
        if (fs.existsSync(filePath)) {
          this.items.set(
            filePath,
            new FileItem(
              path.basename(filePath),
              fs.statSync(filePath).isDirectory()
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
              filePath,
              isChecked
            )
          );
        }
      }
    }
  }

  private savePersistedState() {
    if (!this.persistState) return;

    const state: Record<string, boolean> = {};
    this.items.forEach((item, path) => (state[path] = item.isChecked));
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
          .filter((entry) => {
            // Apply search filter if pattern exists
            if (!this.searchPattern) return true;
            return entry.name
              .toLowerCase()
              .includes(this.searchPattern.toLowerCase());
          })
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
        if (this.excludedPatterns.includes(entry.name)) continue;

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

  async searchFiles() {
    const searchPattern = await vscode.window.showInputBox({
      prompt: "Enter search pattern",
      placeHolder: "e.g., .js, component, etc.",
    });

    if (searchPattern !== undefined) {
      this.setSearchPattern(searchPattern);
    }
  }

  async generateFile() {
    const checkedFiles = this.getCheckedFiles();
    if (checkedFiles.length === 0) {
      vscode.window.showWarningMessage("No files selected!");
      return;
    }

    const fileName =
      (await vscode.window.showInputBox({
        prompt: "Enter output file name (without extension)",
        placeHolder: "context",
        validateInput: (value) =>
          value?.includes(".") ? "No extensions allowed" : null,
      })) || "context";

    try {
      const outputPath = path.join(
        this.workspaceRoot,
        `${fileName}.${this.outputFormat.extension}`
      );
      const contents = await Promise.all(
        checkedFiles.map(async (file) => ({
          path: path.relative(this.workspaceRoot, file),
          content: await fs.promises.readFile(file, "utf8"),
        }))
      );

      await fs.promises.writeFile(
        outputPath,
        contents
          .map(
            ({ path, content }) =>
              this.outputFormat.fileHeaderFormat.replace("{filePath}", path) +
              "\n" +
              content
          )
          .join(this.outputFormat.fileSeparator)
      );

      const doc = await vscode.workspace.openTextDocument(outputPath);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error generating file: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}
