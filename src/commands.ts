import * as vscode from "vscode";
import { PromptTowerProvider } from "./providers/PromptTowerProvider";
import { GitHubIssuesProvider } from "./providers/GitHubIssuesProvider";
import { FileItem } from "./models/FileItem";
import { GitHubConfigManager } from "./utils/githubConfig";

export function registerCommands(
  context: vscode.ExtensionContext,
  provider?: PromptTowerProvider,
  treeView?: vscode.TreeView<FileItem>,
  issuesProvider?: GitHubIssuesProvider
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
      vscode.commands.registerCommand(
        "promptTower.copyContextToClipboard",
        () => provider.copyContextToClipboard()
      ),
      vscode.commands.registerCommand("promptTower.toggleAllFiles", () =>
        provider.toggleAllFiles()
      ),
      vscode.commands.registerCommand("promptTower.clearSelections", () =>
        provider.clearAllSelections()
      ),
      vscode.commands.registerCommand("promptTower.resetAll", () =>
        provider.resetAll()
      )
      // vscode.commands.registerCommand("promptTower.checkboxChanged", (item) => {
      //   provider.toggleCheck(item);
      // })
    );
  } else {
    console.log(
      "Prompt Tower Commands: Skipping TreeView specific commands (provider or treeView undefined)."
    );
  }

  // GitHub-specific commands
  if (issuesProvider) {
    context.subscriptions.push(
      vscode.commands.registerCommand("promptTower.refreshGitHubIssues", () =>
        issuesProvider.reloadIssues()
      ),
      vscode.commands.registerCommand("promptTower.addGitHubToken", async () => {
        // Show input box for token
        const token = await vscode.window.showInputBox({
          title: "Add GitHub Personal Access Token",
          prompt: "Enter your GitHub PAT with 'repo' scope",
          placeHolder: "ghp_...",
          password: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Token cannot be empty";
            }
            if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
              return "Invalid token format. GitHub tokens start with 'ghp_' or 'github_pat_'";
            }
            return null;
          }
        });

        if (token) {
          try {
            // Store the token securely
            await GitHubConfigManager.storePAT(context, token);
            
            // Show success message
            vscode.window.showInformationMessage(
              "GitHub token saved successfully. Refreshing issues..."
            );
            
            // Refresh the issues view
            await issuesProvider.reloadIssues();
          } catch (error) {
            vscode.window.showErrorMessage(
              "Failed to save GitHub token: " + (error as Error).message
            );
          }
        }
      })
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
