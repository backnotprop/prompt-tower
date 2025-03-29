// src/extension.ts

import * as vscode from "vscode";
import { PromptTowerProvider } from "./providers/PromptTowerProvider";
import { registerCommands } from "./commands";

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootPath) {
    vscode.window.showErrorMessage("No workspace open");
    return;
  }

  const provider = new PromptTowerProvider(rootPath, context);
  const treeView = vscode.window.createTreeView("promptTowerView", {
    treeDataProvider: provider,
    canSelectMany: true,
  });

  registerCommands(context, provider, treeView);
}

export function deactivate() {}
