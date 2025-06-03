import * as vscode from "vscode";
import { MultiRootTreeProvider } from "./providers/MultiRootTreeProvider";
import {
  GitHubIssuesProvider,
  GitHubIssue,
} from "./providers/GitHubIssuesProvider";
import { WorkspaceManager } from "./services/WorkspaceManager";
import { FileDiscoveryService } from "./services/FileDiscoveryService";
import { TokenCountingService } from "./services/TokenCountingService";
import { IgnorePatternService } from "./services/IgnorePatternService";
import { ContextGenerationService } from "./services/ContextGenerationService";
import { PromptPushService, AIProvider } from "./services/PromptPushService";
import { EditorAutomationService } from "./services/EditorAutomationService";
import { FileNode } from "./models/FileNode";
import { TokenUpdatePayload } from "./models/Events";
import { GitHubConfigManager } from "./utils/githubConfig";
import { getWebviewHtml, WebviewParams } from "./extension.webview.html";

// --- Webview Panel Handling ---
let webviewPanel: vscode.WebviewPanel | undefined;
const VIEW_TYPE = "promptTowerUI";

// --- Service Instances ---
let workspaceManager: WorkspaceManager;
let ignorePatternService: IgnorePatternService;
let fileDiscoveryService: FileDiscoveryService;
let tokenCountingService: TokenCountingService;
let contextGenerationService: ContextGenerationService;
let promptPushService: PromptPushService;
let editorAutomationService: EditorAutomationService;
let multiRootProvider: MultiRootTreeProvider;
let issuesProviderInstance: GitHubIssuesProvider | undefined;
let mainTreeView: vscode.TreeView<FileNode>;

// --- Preview State ---
let isPreviewValid = false;

// --- Helper Functions ---
function invalidateWebviewPreview() {
  if (webviewPanel && isPreviewValid) {
    console.log("Extension: Sending invalidatePreview to webview.");
    webviewPanel.webview.postMessage({ command: "invalidatePreview" });
    isPreviewValid = false;
  }
}

function resetWebviewPreview() {
  if (webviewPanel) {
    webviewPanel.webview.postMessage({ command: "resetPreview" });
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// --- File Preview Helper ---
async function showFilePreview(fileNode: FileNode): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fileNode.absolutePath)
    );
    
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.One,
      preview: true,
      preserveFocus: true
    });
  } catch (error) {
    console.error(`Failed to preview file ${fileNode.absolutePath}:`, error);
    vscode.window.showErrorMessage(`Could not preview file: ${fileNode.label}`);
  }
}

// --- Webview Content Generation ---
function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialPrefix: string = "",
  initialSuffix: string = ""
): string {
  const nonce = getNonce();

  // Get provider logo URIs
  const chatgptLogo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "chatgpt.png")
  );
  const claudeLogo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "claude.png")
  );
  const geminiLogo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "gemini.png")
  );
  const aistudioLogo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "aistudio.png")
  );
  const cursorLogo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "cursor.png")
  );

  // Use the modular HTML generator
  const params: WebviewParams = {
    nonce,
    cspSource: webview.cspSource,
    chatgptLogo: chatgptLogo.toString(),
    claudeLogo: claudeLogo.toString(),
    geminiLogo: geminiLogo.toString(),
    aistudioLogo: aistudioLogo.toString(),
    cursorLogo: cursorLogo.toString(),
    initialPrefix,
    initialSuffix,
    platform: process.platform,
  };

  return getWebviewHtml(params);
}

// --- Webview Panel Management ---
function createOrShowWebviewPanel(context: vscode.ExtensionContext) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : vscode.ViewColumn.Beside;

  if (webviewPanel) {
    webviewPanel.reveal(column);
    return;
  }

  webviewPanel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    "Prompt Tower",
    column || vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    }
  );

  webviewPanel.webview.html = getWebviewContent(
    webviewPanel.webview,
    context.extensionUri,
    multiRootProvider ? multiRootProvider.getPromptPrefix() : "",
    multiRootProvider ? multiRootProvider.getPromptSuffix() : ""
  );

  // Handle messages from webview
  webviewPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "updatePrefix":
          if (multiRootProvider && typeof message.text === "string") {
            multiRootProvider.setPromptPrefix(message.text);
            invalidateWebviewPreview();
          }
          break;

        case "updateSuffix":
          if (multiRootProvider && typeof message.text === "string") {
            multiRootProvider.setPromptSuffix(message.text);
            invalidateWebviewPreview();
          }
          break;

        case "webviewReady":
          if (multiRootProvider && webviewPanel) {
            // Send initial state
            webviewPanel.webview.postMessage({
              command: "updatePrefix",
              text: multiRootProvider.getPromptPrefix(),
            });
            webviewPanel.webview.postMessage({
              command: "updateSuffix",
              text: multiRootProvider.getPromptSuffix(),
            });
            webviewPanel.webview.postMessage({
              command: "tokenUpdate",
              payload: {
                count: tokenCountingService.getCurrentTokenCount(),
                isCounting: tokenCountingService.getIsCounting(),
              },
            });
            // Send initial tree visibility state
            webviewPanel.webview.postMessage({
              command: "treeVisibilityChanged",
              visible: mainTreeView.visible,
            });
          }
          break;

        case "createContext":
          if (multiRootProvider && contextGenerationService && webviewPanel) {
            try {
              // Process options from webview
              const options = message.options || {};
              const treeType = options.treeType || "fullFilesAndDirectories";
              const copyToClipboard = options.copyToClipboard ?? true;
              const removeComments = options.removeComments ?? false;

              const allRootNodes = multiRootProvider.getRootNodes();

              // Generate context with tree type option
              const result = await contextGenerationService.generateContext(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                  treeType: treeType,
                }
              );

              // Copy to clipboard if option is checked
              if (copyToClipboard) {
                await vscode.env.clipboard.writeText(result.contextString);
                vscode.window.showInformationMessage(
                  "✨ Context copied to clipboard!"
                );
              }

              webviewPanel.webview.postMessage({
                command: "updatePreview",
                payload: { context: result.contextString },
              });
              isPreviewValid = true;
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error generating context: ${error}`
              );
            }
          }
          break;

        case "createAndCopyToClipboard":
          if (multiRootProvider && contextGenerationService) {
            try {
              const allRootNodes = multiRootProvider.getRootNodes();
              const result = await contextGenerationService.copyToClipboard(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                }
              );

              if (webviewPanel) {
                webviewPanel.webview.postMessage({
                  command: "updatePreview",
                  payload: { context: result.contextString },
                });
                isPreviewValid = true;
              }
            } catch (error) {
              console.error("Error in createAndCopyToClipboard:", error);
            }
          }
          break;

        case "clearSelections":
          if (multiRootProvider) {
            multiRootProvider.clearAllSelections();
          }
          break;

        case "resetAll":
          if (multiRootProvider && webviewPanel) {
            // Reset all selections (files and GitHub issues)
            multiRootProvider.resetAll();

            // Clear prompt prefix and suffix
            multiRootProvider.setPromptPrefix("");
            multiRootProvider.setPromptSuffix("");

            // Update webview with empty values
            webviewPanel.webview.postMessage({
              command: "updatePrefix",
              text: "",
            });
            webviewPanel.webview.postMessage({
              command: "updateSuffix",
              text: "",
            });

            // Clear context preview
            webviewPanel.webview.postMessage({
              command: "updatePreview",
              payload: { context: "" },
            });

            // Reset preview state
            isPreviewValid = false;

            // Show confirmation
            vscode.window.showInformationMessage(
              "✨ Everything has been reset!"
            );
          }
          break;

        case "showToast":
          if (message.payload && typeof message.payload.message === "string") {
            vscode.window.showInformationMessage(message.payload.message);
          }
          break;

        case "showTree":
          // Focus the Prompt Tower tree view to make it visible
          await vscode.commands.executeCommand("workbench.view.extension.prompt-tower");
          break;

        case "pushPrompt":
          if (
            message.provider &&
            multiRootProvider &&
            contextGenerationService &&
            promptPushService
          ) {
            try {
              // Check if this is the first time using automation
              const isFirstTime = !context.globalState.get(
                "promptTower.automationUsed",
                false
              );

              if (isFirstTime) {
                // Show onboarding modal and return early
                if (webviewPanel) {
                  webviewPanel.webview.postMessage({
                    command: "showOnboardingModal",
                  });
                }
                return;
              }
              const allRootNodes = multiRootProvider.getRootNodes();
              const result = await contextGenerationService.generateContext(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                }
              );

              // Validate provider type
              const provider = message.provider as AIProvider;
              const autoSubmit = message.autoSubmit ?? true;

              if (
                !promptPushService.getSupportedProviders().includes(provider)
              ) {
                throw new Error(`Unsupported provider: ${provider}`);
              }

              // Attempt to push the prompt to the AI provider
              const pushResult = await promptPushService.pushPrompt(
                provider,
                result.contextString,
                autoSubmit
              );

              if (pushResult.success) {
                // Show success message
                vscode.window.showInformationMessage(
                  `✨ Prompt successfully pushed to ${promptPushService.getProviderDisplayName(
                    provider
                  )}!`
                );
              } else {
                // Handle different failure scenarios
                if (pushResult.requiresPermissions) {
                  const enablePermissions =
                    await vscode.window.showWarningMessage(
                      `❌ ${pushResult.error}\n\nTo enable automated prompt pushing on macOS, VS Code needs Accessibility permissions.`,
                      "Open System Preferences",
                      "Copy to Clipboard Only"
                    );

                  if (enablePermissions === "Open System Preferences") {
                    vscode.env.openExternal(
                      vscode.Uri.parse(
                        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                      )
                    );
                  }
                } else if (pushResult.fallbackToClipboard) {
                  vscode.window.showWarningMessage(
                    `⚠️ ${pushResult.error}\n\nPrompt copied to clipboard as fallback.`
                  );
                } else {
                  vscode.window.showErrorMessage(
                    `❌ Failed to push prompt: ${pushResult.error}`
                  );
                }
              }

              // Update preview if webview is still active
              if (webviewPanel) {
                webviewPanel.webview.postMessage({
                  command: "updatePreview",
                  payload: { context: result.contextString },
                });
                isPreviewValid = true;
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error pushing prompt to ${message.provider}: ${error}`
              );
            }
          }
          break;

        case "completeOnboarding":
          // Mark automation as used and proceed with the original push prompt request
          await context.globalState.update("promptTower.automationUsed", true);

          if (
            message.originalRequest &&
            multiRootProvider &&
            contextGenerationService &&
            promptPushService
          ) {
            // Re-execute the original push prompt request
            const originalMessage = message.originalRequest;
            try {
              const allRootNodes = multiRootProvider.getRootNodes();
              const result = await contextGenerationService.generateContext(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                }
              );

              // Validate provider type
              const provider = originalMessage.provider as AIProvider;
              const autoSubmit = originalMessage.autoSubmit ?? true;

              if (
                !promptPushService.getSupportedProviders().includes(provider)
              ) {
                throw new Error(`Unsupported provider: ${provider}`);
              }

              // Attempt to push the prompt to the AI provider
              const pushResult = await promptPushService.pushPrompt(
                provider,
                result.contextString,
                autoSubmit
              );

              if (pushResult.success) {
                vscode.window.showInformationMessage(
                  `✨ Prompt successfully pushed to ${promptPushService.getProviderDisplayName(
                    provider
                  )}!`
                );
              } else {
                // Handle failure scenarios (same as original handler)
                if (pushResult.requiresPermissions) {
                  const enablePermissions =
                    await vscode.window.showWarningMessage(
                      `❌ ${pushResult.error}\n\nTo enable automated prompt pushing on macOS, VS Code needs Accessibility permissions.`,
                      "Open System Preferences",
                      "Copy to Clipboard Only"
                    );

                  if (enablePermissions === "Open System Preferences") {
                    vscode.env.openExternal(
                      vscode.Uri.parse(
                        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                      )
                    );
                  }
                } else if (pushResult.fallbackToClipboard) {
                  vscode.window.showWarningMessage(
                    `⚠️ ${pushResult.error}\n\nPrompt copied to clipboard as fallback.`
                  );
                } else {
                  vscode.window.showErrorMessage(
                    `❌ Failed to push prompt: ${pushResult.error}`
                  );
                }
              }

              // Update preview
              if (webviewPanel) {
                webviewPanel.webview.postMessage({
                  command: "updatePreview",
                  payload: { context: result.contextString },
                });
                isPreviewValid = true;
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error pushing prompt to ${originalMessage.provider}: ${error}`
              );
            }
          }
          break;

        case "sendToEditor":
          if (
            multiRootProvider &&
            contextGenerationService &&
            editorAutomationService
          ) {
            try {
              // Generate context (similar to createContext flow)
              const allRootNodes = multiRootProvider.getRootNodes();
              const result = await contextGenerationService.generateContext(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                }
              );

              // Update preview if webview is active
              if (webviewPanel) {
                webviewPanel.webview.postMessage({
                  command: "updatePreview",
                  payload: { context: result.contextString },
                });
                isPreviewValid = true;
              }

              // Get target from message or default to agent
              const target = message.target || "agent";

              // Send to Cursor using the service
              const automationResult =
                await editorAutomationService.sendToEditor(
                  "cursor",
                  target as any,
                  result.contextString
                );

              if (automationResult.success) {
                vscode.window.showInformationMessage(
                  `✨ Context sent to ${editorAutomationService.getEditorDisplayName(
                    "cursor"
                  )} ${editorAutomationService.getTargetDisplayName(
                    target as any
                  )}!`
                );
              } else {
                // Handle different failure scenarios
                if (automationResult.requiresPermissions) {
                  const enablePermissions =
                    await vscode.window.showWarningMessage(
                      `❌ ${automationResult.error}\n\nTo enable editor automation on macOS, VS Code needs Accessibility permissions.`,
                      "Open System Preferences",
                      "Copy to Clipboard Only"
                    );

                  if (enablePermissions === "Open System Preferences") {
                    vscode.env.openExternal(
                      vscode.Uri.parse(
                        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                      )
                    );
                  } else {
                    // Fallback: just copy to clipboard
                    await vscode.env.clipboard.writeText(result.contextString);
                    vscode.window.showInformationMessage(
                      "📋 Context copied to clipboard as fallback."
                    );
                  }
                } else {
                  vscode.window.showErrorMessage(
                    `❌ Failed to send to editor chat: ${automationResult.error}`
                  );
                }
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error sending context to editor: ${error}`
              );
            }
          }
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  webviewPanel.onDidDispose(
    () => {
      webviewPanel = undefined;
    },
    null,
    context.subscriptions
  );
}

// --- Extension Activation ---
export function activate(context: vscode.ExtensionContext) {
  console.log("Prompt Tower: Activating with new clean architecture...");

  // Initialize services
  workspaceManager = new WorkspaceManager();
  ignorePatternService = new IgnorePatternService(context);
  fileDiscoveryService = new FileDiscoveryService(ignorePatternService);
  tokenCountingService = new TokenCountingService();
  contextGenerationService = new ContextGenerationService();
  promptPushService = new PromptPushService();
  editorAutomationService = new EditorAutomationService();

  // Check if we have workspaces
  if (!workspaceManager.hasWorkspaces()) {
    vscode.window.showInformationMessage(
      "Prompt Tower: No workspace open. Tree view not available."
    );
    return;
  }

  // Initialize main tree provider
  multiRootProvider = new MultiRootTreeProvider(
    workspaceManager,
    fileDiscoveryService,
    tokenCountingService,
    ignorePatternService,
    context
  );

  // Create tree view
  mainTreeView = vscode.window.createTreeView("promptTowerView", {
    treeDataProvider: multiRootProvider,
    canSelectMany: true,
    showCollapseAll: true,
    manageCheckboxStateManually: true,
  });

  // Auto-open webview when activity bar is clicked (tree view becomes visible)
  context.subscriptions.push(
    mainTreeView.onDidChangeVisibility((e) => {
      if (e.visible) {
        // Activity bar was clicked - open the webview
        createOrShowWebviewPanel(context);
      }
      
      // Notify webview about tree visibility changes
      if (webviewPanel) {
        webviewPanel.webview.postMessage({
          command: "treeVisibilityChanged",
          visible: e.visible
        });
      }
    })
  );

  // Handle checkbox clicks (checkboxes are separate from row content)
  context.subscriptions.push(
    mainTreeView.onDidChangeCheckboxState(async (evt) => {
      console.log(`[Prompt Tower] Checkbox event triggered for ${evt.items.length} items`);
      for (const [item, state] of evt.items) {
        if (
          item &&
          typeof item === "object" &&
          "type" in item &&
          "absolutePath" in item
        ) {
          console.log(`[Prompt Tower] Checkbox toggle: ${(item as any).label} -> ${state === 1 ? 'checked' : 'unchecked'}`);
          await multiRootProvider.toggleNodeSelection(item as FileNode);
        }
      }
      invalidateWebviewPreview();
    })
  );

  // Row content clicks are handled via commands set on each TreeItem
  // See promptTower.toggleFileSelection command registration below

  // Initialize GitHub Issues provider
  const primaryWorkspace = workspaceManager.getPrimaryWorkspace();
  if (primaryWorkspace) {
    issuesProviderInstance = new GitHubIssuesProvider(
      context,
      primaryWorkspace.rootPath
    );
    const issuesTreeView = vscode.window.createTreeView(
      "promptTowerIssuesView",
      {
        treeDataProvider: issuesProviderInstance,
        showCollapseAll: false,
        canSelectMany: true,
        manageCheckboxStateManually: true,
      }
    );

    context.subscriptions.push(
      issuesTreeView.onDidChangeCheckboxState(async (evt) => {
        for (const [item, state] of evt.items) {
          if (item instanceof GitHubIssue && issuesProviderInstance) {
            await issuesProviderInstance.toggleIssueSelection(item);
          }
        }
        // Invalidate preview when issue selections change
        invalidateWebviewPreview();
      })
    );

    context.subscriptions.push(issuesTreeView);

    // Connect the providers for context generation
    multiRootProvider.setGitHubIssuesProvider(issuesProviderInstance);
    contextGenerationService.setGitHubIssuesProvider(issuesProviderInstance);
  }

  // Setup token counting events
  context.subscriptions.push(
    tokenCountingService.onDidChangeTokens((payload: TokenUpdatePayload) => {
      if (webviewPanel) {
        webviewPanel.webview.postMessage({ command: "tokenUpdate", payload });
        invalidateWebviewPreview();
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("promptTower.showTowerUI", () => {
      createOrShowWebviewPanel(context);
    }),

    // Handle tree item clicks (whole row clickable)
    vscode.commands.registerCommand("promptTower.toggleFileSelection", async (fileNode: FileNode) => {
      console.log(`[Prompt Tower] Row content click: ${fileNode.label} (${fileNode.type})`);
      await multiRootProvider.toggleNodeSelection(fileNode);
      invalidateWebviewPreview();
    }),

    vscode.commands.registerCommand("promptTower.refresh", async () => {
      await multiRootProvider.refresh();
    }),

    vscode.commands.registerCommand("promptTower.clearSelections", () => {
      multiRootProvider.clearAllSelections();
    }),

    vscode.commands.registerCommand("promptTower.toggleAllFiles", async () => {
      await multiRootProvider.toggleAllFiles();
    }),

    vscode.commands.registerCommand("promptTower.copyToClipboard", async () => {
      if (contextGenerationService) {
        const allRootNodes = multiRootProvider.getRootNodes();
        await contextGenerationService.copyToClipboard(allRootNodes, {
          prefix: multiRootProvider.getPromptPrefix(),
          suffix: multiRootProvider.getPromptSuffix(),
        });
      }
    }),

    // Also register with old name for compatibility
    vscode.commands.registerCommand(
      "promptTower.copyContextToClipboard",
      async () => {
        if (contextGenerationService) {
          const allRootNodes = multiRootProvider.getRootNodes();
          await contextGenerationService.copyToClipboard(allRootNodes, {
            prefix: multiRootProvider.getPromptPrefix(),
            suffix: multiRootProvider.getPromptSuffix(),
          });
        }
      }
    ),

    // GitHub Issues commands
    vscode.commands.registerCommand(
      "promptTower.refreshGitHubIssues",
      async () => {
        if (issuesProviderInstance) {
          await issuesProviderInstance.reloadIssues();
        }
      }
    ),

    vscode.commands.registerCommand("promptTower.addGitHubToken", async () => {
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
        },
      });

      if (token) {
        try {
          await GitHubConfigManager.storePAT(context, token);
          vscode.window.showInformationMessage(
            "GitHub token saved successfully. Refreshing issues..."
          );

          if (issuesProviderInstance) {
            await issuesProviderInstance.reloadIssues();
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            "Failed to save GitHub token: " + (error as Error).message
          );
        }
      }
    }),

    vscode.commands.registerCommand(
      "promptTower.removeGitHubToken",
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          "Remove stored GitHub token? You'll need to re-add it to access private repositories.",
          "Remove Token",
          "Cancel"
        );

        if (confirm === "Remove Token") {
          try {
            await GitHubConfigManager.removePAT(context);

            vscode.window.showInformationMessage(
              "GitHub token removed successfully. Refreshing issues..."
            );

            if (issuesProviderInstance) {
              await issuesProviderInstance.reloadIssues();
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              "Failed to remove GitHub token: " + (error as Error).message
            );
          }
        }
      }
    ),

    vscode.commands.registerCommand("promptTower.addCurrentFile", async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showWarningMessage(
          "No active file open to add to Prompt Tower."
        );
        return;
      }

      const filePath = activeEditor.document.uri.fsPath;

      // Wait for initialization if needed
      if (!multiRootProvider) {
        vscode.window.showWarningMessage(
          "Prompt Tower is initializing. Please try again in a moment."
        );
        return;
      }

      // Make sure the provider is fully initialized
      if (
        !multiRootProvider.getRootNodes() ||
        multiRootProvider.getRootNodes().length === 0
      ) {
        vscode.window.showWarningMessage(
          "Prompt Tower is still loading files. Please try again in a moment."
        );
        return;
      }

      // Find the file node in the tree
      const fileNode = multiRootProvider.findNodeByPath(filePath);

      if (!fileNode) {
        vscode.window.showWarningMessage(
          `File "${activeEditor.document.fileName}" not found in Prompt Tower workspace. Make sure it's not ignored by .gitignore or .towerignore.`
        );
        return;
      }

      if (fileNode.isChecked) {
        vscode.window.showInformationMessage(
          `File "${fileNode.label}" is already selected in Prompt Tower.`
        );
        return;
      }

      // Select the file using the existing selection system
      await multiRootProvider.toggleNodeSelection(fileNode);

      vscode.window.showInformationMessage(
        `✅ Added "${fileNode.label}" to Prompt Tower selection.`
      );
    }),

    vscode.commands.registerCommand("promptTower.openPromptTower", async () => {
      // Focus the Prompt Tower activity bar view (shows the tree views)
      await vscode.commands.executeCommand(
        "workbench.view.extension.prompt-tower"
      );

      // Open the Prompt Tower UI panel
      createOrShowWebviewPanel(context);

      vscode.window.showInformationMessage("Opened Prompt Tower interface.");
    }),

    // Right-click file preview
    vscode.commands.registerCommand("promptTower.previewFile", async (fileNode: FileNode) => {
      console.log(`[Prompt Tower] Right-click preview: ${fileNode.label}`);
      await showFilePreview(fileNode);
    })
  );

  context.subscriptions.push(mainTreeView, multiRootProvider);

  // Don't automatically show the panel - let users open it when they want
  // vscode.commands.executeCommand("promptTower.showTowerUI");

  console.log("Prompt Tower: Activation complete with clean architecture!");
}

export function deactivate() {
  console.log('Deactivating "prompt-tower" with clean architecture');

  if (webviewPanel) {
    webviewPanel.dispose();
  }

  // Services will be disposed via context.subscriptions
}
