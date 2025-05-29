import * as vscode from "vscode";
import { MultiRootTreeProvider } from "./providers/MultiRootTreeProvider";
import { GitHubIssuesProvider, GitHubIssue } from "./providers/GitHubIssuesProvider";
import { WorkspaceManager } from "./services/WorkspaceManager";
import { FileDiscoveryService } from "./services/FileDiscoveryService";
import { TokenCountingService } from "./services/TokenCountingService";
import { IgnorePatternService } from "./services/IgnorePatternService";
import { ContextGenerationService } from "./services/ContextGenerationService";
import { FileNode } from "./models/FileNode";
import { TokenUpdatePayload } from "./models/Events";

// --- Webview Panel Handling ---
let webviewPanel: vscode.WebviewPanel | undefined;
const VIEW_TYPE = "promptTowerUI";

// --- Service Instances ---
let workspaceManager: WorkspaceManager;
let ignorePatternService: IgnorePatternService;
let fileDiscoveryService: FileDiscoveryService;
let tokenCountingService: TokenCountingService;
let contextGenerationService: ContextGenerationService;
let multiRootProvider: MultiRootTreeProvider;
let issuesProviderInstance: GitHubIssuesProvider | undefined;

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
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// --- Webview Content Generation ---
function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialPrefix: string = "",
  initialSuffix: string = ""
): string {
  const nonce = getNonce();
  const styles = `
        body {
            padding: 1em;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.4;
            box-sizing: border-box;
        }
        #app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        h1 {
            margin-top: 0;
            font-size: 1.5em;
            border-bottom: 1px solid var(--vscode-separator-foreground);
            padding-bottom: 0.3em;
            margin-bottom: 0.8em;
        }
        #token-info {
            margin-bottom: 1em;
            padding: 10px 12px;
            border: 1px solid var(--vscode-editorWidget-border, #ccc);
            border-radius: 4px;
            background-color: var(--vscode-editorWidget-background, #f0f0f0);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        #token-count {
            font-weight: bold;
            font-size: 1.1em;
            color: var(--vscode-charts-blue);
        }
        #token-status {
            font-style: italic;
            color: var(--vscode-descriptionForeground, #777);
            flex-grow: 1;
        }
        .spinner {
            display: inline-block;
            width: 1em;
            height: 1em;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: spinner-border .75s linear infinite;
            vertical-align: middle;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            margin-left: 5px;
        }
        .spinner.visible {
            opacity: 1;
        }
        @keyframes spinner-border {
            to { transform: rotate(360deg); }
        }
        button {
             color: var(--vscode-button-foreground);
             background-color: var(--vscode-button-background);
             border: 1px solid var(--vscode-button-border, transparent);
             padding: 5px 10px;
             cursor: pointer;
             border-radius: 2px;
        }
        button:hover {
             background-color: var(--vscode-button-hoverBackground);
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-input-foreground);
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
          min-height: 80px;
          resize: vertical;
        }
        .textarea-container {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }
        label {
          margin-bottom: 0.4em;
          font-weight: bold;
          color: var(--vscode-descriptionForeground);
        }
        #preview-container {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            min-height: 0;
            margin-top: 0px;
            border-top: 1px solid var(--vscode-separator-foreground);
            padding-top: 1em;
        }
        #context-preview {
            flex-grow: 1;
            height: 256px;
            min-height: 100px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-editorWidget-background);
            color: var(--vscode-input-foreground);
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: var(--vscode-editor-font-family, monospace);
        }
    `;

  return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${webview.cspSource} 'unsafe-inline';
                img-src ${webview.cspSource} https: data:;
                script-src 'nonce-${nonce}';
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Prompt Tower UI</title>
            <style nonce="${nonce}">${styles}</style>
        </head>
        <body>
            <div id="app">
              <h1>Prompt Tower</h1>
              <div id="token-info">
                  <span>Selected Tokens:</span>
                  <span id="token-count">0</span>
                  <div id="spinner" class="spinner"></div>
                  <span id="token-status"></span>
              </div>

              <div style="margin-bottom: 1em;">
                  <button id="clearButton">Clear Selected</button> 
                  <button id="resetAllButton">Reset All</button>
              </div>

              <div id="prompt-prefix-container" class="textarea-container">
                <label for="prompt-prefix">Prompt Prefix</label>
                <textarea id="prompt-prefix">${initialPrefix}</textarea>
              </div>

              <div id="prompt-suffix-container" class="textarea-container">
                <label for="prompt-suffix">Prompt Suffix</label>
                <textarea id="prompt-suffix">${initialSuffix}</textarea>
              </div>

              <div style="margin-bottom: 1em;">
                <button id="createContextButton">Create Context</button>
                <button id="createAndCopyButton">Create & Copy to Clipboard</button>
              </div>

              <div id="preview-container">
                  <label for="context-preview">Context Preview</label>
                  <textarea id="context-preview" readonly></textarea>
              </div>
            </div>
            <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    const tokenCountElement = document.getElementById('token-count');
                    const tokenStatusElement = document.getElementById('token-status');
                    const spinnerElement = document.getElementById('spinner');
                    const prefixTextArea = document.getElementById("prompt-prefix");
                    const suffixTextArea = document.getElementById("prompt-suffix");
                    const previewTextArea = document.getElementById("context-preview");
                    
                    // Event listeners
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'tokenUpdate':
                                if (message.payload && tokenCountElement && tokenStatusElement && spinnerElement) {
                                    const { count, isCounting } = message.payload;
                                    tokenCountElement.textContent = count.toLocaleString();
                                    if (isCounting) {
                                        tokenStatusElement.textContent = '(Calculating...)';
                                        spinnerElement.classList.add('visible');
                                    } else {
                                        tokenStatusElement.textContent = '';
                                        spinnerElement.classList.remove('visible');
                                    }
                                }
                                break;
                            case 'updatePrefix':
                                if (prefixTextArea && typeof message.text === 'string') {
                                    prefixTextArea.value = message.text;
                                }
                                break;
                            case 'updateSuffix':
                                if (suffixTextArea && typeof message.text === 'string') {
                                    suffixTextArea.value = message.text;
                                }
                                break;
                            case 'updatePreview':
                                if (message.payload && previewTextArea) {
                                    previewTextArea.value = message.payload.context;
                                }
                                break;
                        }
                    });
                    
                    // Input event listeners
                    if (prefixTextArea) {
                        prefixTextArea.addEventListener("input", (e) => {
                            vscode.postMessage({ command: "updatePrefix", text: e.target.value });
                        });
                    }
                    if (suffixTextArea) {
                        suffixTextArea.addEventListener("input", (e) => {
                            vscode.postMessage({ command: "updateSuffix", text: e.target.value });
                        });
                    }
                    
                    // Button event listeners
                    document.getElementById('createContextButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "createContext" });
                    });
                    
                    document.getElementById('createAndCopyButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "createAndCopyToClipboard" });
                    });
                    
                    document.getElementById('clearButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "clearSelections" });
                    });
                    
                    document.getElementById('resetAllButton')?.addEventListener("click", () => {
                        vscode.postMessage({ command: "resetAll" });
                    });
                    
                    vscode.postMessage({ command: "webviewReady" });
                }());
              </script>
          </body>
        </html>`;
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
          }
          break;
          
        case "createContext":
          if (multiRootProvider && contextGenerationService && webviewPanel) {
            try {
              const allRootNodes = multiRootProvider.getRootNodes();
              const result = await contextGenerationService.generateContext(
                allRootNodes,
                {
                  prefix: multiRootProvider.getPromptPrefix(),
                  suffix: multiRootProvider.getPromptSuffix(),
                }
              );
              
              webviewPanel.webview.postMessage({
                command: "updatePreview",
                payload: { context: result.contextString },
              });
              isPreviewValid = true;
            } catch (error) {
              vscode.window.showErrorMessage(`Error generating context: ${error}`);
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
          if (multiRootProvider) {
            multiRootProvider.resetAll();
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
  const treeView = vscode.window.createTreeView("promptTowerView", {
    treeDataProvider: multiRootProvider,
    canSelectMany: true,
    showCollapseAll: true,
    manageCheckboxStateManually: true,
  });
  
  // Handle checkbox state changes
  context.subscriptions.push(
    treeView.onDidChangeCheckboxState(async (evt) => {
      for (const [item, state] of evt.items) {
        if (item && typeof item === 'object' && 'type' in item && 'absolutePath' in item) {
          await multiRootProvider.toggleNodeSelection(item as FileNode);
        }
      }
    })
  );
  
  // Initialize GitHub Issues provider
  const primaryWorkspace = workspaceManager.getPrimaryWorkspace();
  if (primaryWorkspace) {
    issuesProviderInstance = new GitHubIssuesProvider(context, primaryWorkspace.rootPath);
    const issuesTreeView = vscode.window.createTreeView("promptTowerIssuesView", {
      treeDataProvider: issuesProviderInstance,
      showCollapseAll: false,
      canSelectMany: true,
      manageCheckboxStateManually: true,
    });
    
    context.subscriptions.push(
      issuesTreeView.onDidChangeCheckboxState(async (evt) => {
        for (const [item, state] of evt.items) {
          if (item instanceof GitHubIssue && issuesProviderInstance) {
            await issuesProviderInstance.toggleIssueSelection(item);
          }
        }
      })
    );
    
    context.subscriptions.push(issuesTreeView);
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
    
    vscode.commands.registerCommand("promptTower.refresh", async () => {
      await multiRootProvider.refresh();
    }),
    
    vscode.commands.registerCommand("promptTower.clearSelections", () => {
      multiRootProvider.clearAllSelections();
    }),
    
    vscode.commands.registerCommand("promptTower.toggleAll", async () => {
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
    })
  );
  
  context.subscriptions.push(treeView, multiRootProvider);
  
  // Automatically show the panel
  vscode.commands.executeCommand("promptTower.showTowerUI");
  
  console.log("Prompt Tower: Activation complete with clean architecture!");
}

export function deactivate() {
  console.log('Deactivating "prompt-tower" with clean architecture');
  
  if (webviewPanel) {
    webviewPanel.dispose();
  }
  
  // Services will be disposed via context.subscriptions
}