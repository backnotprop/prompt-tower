import * as vscode from "vscode";
import { PromptTowerProvider } from "./providers/PromptTowerProvider";
import { FileItem } from "./models/FileItem";

export function registerCommands(
  context: vscode.ExtensionContext,
  provider?: PromptTowerProvider,
  treeView?: vscode.TreeView<FileItem>
) {
  if (provider && treeView) {
    console.log(
      "Prompt Tower Commands: Registering TreeView specific commands."
    );
    context.subscriptions.push(
      treeView.onDidChangeCheckboxState((evt) =>
        evt.items.forEach(([item]) => provider.toggleCheck(item))
      ),
      vscode.commands.registerCommand("promptTower.refresh", () =>
        provider.refresh()
      ),
      vscode.commands.registerCommand("promptTower.generateFile", () =>
        provider.copyContextToClipboard()
      ),
      vscode.commands.registerCommand("promptTower.toggleAllFiles", () =>
        provider.toggleAllFiles()
      ),
      vscode.commands.registerCommand("promptTower.clearSelections", () =>
        provider.clearAllSelections()
      ),
      vscode.commands.registerCommand("promptTower.checkboxChanged", (item) => {
        provider.toggleCheck(item);
      })
    );
  } else {
    console.log(
      "Prompt Tower Commands: Skipping TreeView specific commands (provider or treeView undefined)."
    );
  }

  console.log(
    "Prompt Tower Commands: Registering configuration change listener."
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((evt) => {
      if (evt.affectsConfiguration("promptTower")) {
        vscode.window
          .showInformationMessage(
            "Configuration updated. Please reload VS Code for changes to take effect.",
            "Reload"
          )
          .then((selection) => {
            if (selection === "Reload") {
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });
      }
    })
  );
}
