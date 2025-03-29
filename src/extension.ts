// src/extension.ts

import * as vscode from "vscode";
import { PromptTowerProvider } from "./providers/PromptTowerProvider";
import { registerCommands } from "./commands";
import { FileItem } from "./models/FileItem";
import { TokenUpdateEmitter, TokenUpdatePayload } from "./models/EventEmitter";

// --- Webview Panel Handling ---
let webviewPanel: vscode.WebviewPanel | undefined;
const VIEW_TYPE = "promptTowerUI"; // Unique identifier for the webview panel

// --- Shared State/Communication ---
const tokenUpdateEmitter = new TokenUpdateEmitter();

// --- Reference to the provider instance ---
let providerInstance: PromptTowerProvider | undefined;

// Generates a random nonce string for Content Security Policy
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Generates the HTML content for the Webview Panel
function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = getNonce();
  // Define styles - Consider moving to a separate CSS file (e.g., media/style.css) for larger projects
  const styles = `
        body {
            padding: 1em;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.4;
        }
        h1 {
            margin-top: 0;
            font-size: 1.5em; /* Adjust as needed */
            border-bottom: 1px solid var(--vscode-separator-foreground);
            padding-bottom: 0.3em;
            margin-bottom: 0.8em;
        }
        #token-info {
            margin-top: 15px;
            padding: 10px 12px;
            border: 1px solid var(--vscode-editorWidget-border, #ccc);
            border-radius: 4px;
            background-color: var(--vscode-editorWidget-background, #f0f0f0);
            display: flex; /* Use flexbox for alignment */
            align-items: center; /* Vertically align items */
            gap: 8px; /* Space between items */
        }
        #token-count {
            font-weight: bold;
            font-size: 1.1em; /* Make count slightly larger */
            color: var(--vscode-charts-blue); /* Use a theme color */
        }
        #token-status {
            font-style: italic;
            color: var(--vscode-descriptionForeground, #777);
            flex-grow: 1; /* Allow status to take remaining space */
        }
        .spinner {
            display: inline-block;
            width: 1em; /* Size relative to font */
            height: 1em;
            border: 2px solid currentColor; /* Use text color */
            border-right-color: transparent; /* Hide one side for spin effect */
            border-radius: 50%;
            animation: spinner-border .75s linear infinite;
            vertical-align: middle; /* Align better with text */
            opacity: 0; /* Hidden by default */
            transition: opacity 0.2s ease-in-out;
            margin-left: 5px;
        }
        .spinner.visible {
            opacity: 1; /* Show when counting */
        }
        @keyframes spinner-border {
            to { transform: rotate(360deg); }
        }
        hr {
            border: none;
            border-top: 1px solid var(--vscode-separator-foreground);
            margin: 1.5em 0;
        }
        button {
             /* Use VS Code button styles */
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
        button:active {
             background-color: var(--vscode-button-background); /* Or a slightly darker variant */
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
            <h1>Prompt Tower</h1>

            <div id="token-info">
                <span>Selected Tokens:</span>
                <span id="token-count">0</span>
                <div id="spinner" class="spinner"></div>
                <span id="token-status"></span>
            </div>

            <hr>
            <p>Additional controls and prompt preview will go here.</p>
             <button id="testButton">Test Message</button> <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi(); // Get VS Code API access

                    // Get references to the elements to update
                    const tokenCountElement = document.getElementById('token-count');
                    const tokenStatusElement = document.getElementById('token-status');
                    const spinnerElement = document.getElementById('spinner');
                    const testButton = document.getElementById('testButton'); // Get test button

                    // --- Event Listener for Messages from Extension ---
                    window.addEventListener('message', event => {
                        const message = event.data; // The JSON data sent from the extension

                        switch (message.command) {
                            case 'tokenUpdate':
                                if (message.payload && tokenCountElement && tokenStatusElement && spinnerElement) {
                                    const { count, isCounting } = message.payload;

                                    // Format large numbers with commas
                                    tokenCountElement.textContent = count.toLocaleString();

                                    if (isCounting) {
                                        tokenStatusElement.textContent = '(Calculating...)';
                                        spinnerElement.classList.add('visible');
                                    } else {
                                        tokenStatusElement.textContent = ''; // Clear status text
                                        spinnerElement.classList.remove('visible');
                                    }
                                }
                                break;

                            // Add other command handlers here if needed in the future
                            // case 'someOtherCommand':
                            //    // ... handle other commands ...
                            //    break;
                        }
                    });

                    // --- Event Listener for Test Button ---
                     if (testButton) {
                        testButton.addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'alert', // Command for the extension to handle
                                text: 'Test button clicked successfully!' // Data to send
                            });
                        });
                    }


                    // --- Optional: Notify Extension when Webview is Ready ---
                    // Useful if the extension needs to know when to send initial data.
                    // vscode.postMessage({ command: 'webviewReady' });
                    // console.log('Webview script loaded and ready.');

                }()); // Immediately invoke the function to scope variables
              </script>
          </body>
        </html>`;
}

function createOrShowWebviewPanel(context: vscode.ExtensionContext) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : vscode.ViewColumn.One; // Default to column One if no editor is active

  // If we already have a panel, show it.
  if (webviewPanel) {
    webviewPanel.reveal(column);
    console.log("Prompt Tower UI: Revealed existing panel."); // Log for debugging
    return;
  }

  console.log("Prompt Tower UI: Creating new panel."); // Log for debugging
  // Otherwise, create a new panel.
  webviewPanel = vscode.window.createWebviewPanel(
    VIEW_TYPE, // Identifies the type of the webview. Used internally
    "Prompt Tower UI", // Title of the panel displayed to the user
    column || vscode.ViewColumn.One, // Editor column to show the new webview panel in.
    {
      // Enable javascript in the webview
      enableScripts: true,
      localResourceRoots: [context.extensionUri], // Allow loading from extension root for now
      retainContextWhenHidden: true, // Keep webview alive when not visible
    }
  );

  webviewPanel.webview.html = getWebviewContent(
    webviewPanel.webview,
    context.extensionUri
  );

  // --- Listener for Token Updates from Provider ---
  // Make sure the listener is disposed only when the extension deactivates,
  // not necessarily when the panel closes, so it can re-attach if panel reopens.
  // We add it to context.subscriptions.
  context.subscriptions.push(
    tokenUpdateEmitter.event((payload: TokenUpdatePayload) => {
      // Only post if the panel currently exists
      if (webviewPanel) {
        webviewPanel.webview.postMessage({ command: "tokenUpdate", payload });
      }
    })
  );

  // --- Handle messages FROM the webview ---
  webviewPanel.webview.onDidReceiveMessage(
    (message) => {
      console.log("Message received from webview:", message);
      switch (message.command) {
        case "alert": // Handle the alert command from the test button
          if (message.text) {
            vscode.window.showInformationMessage(
              `Webview Message: ${message.text}`
            );
          }
          return;
        case "webviewReady": // Handle optional ready message
          console.log("Prompt Tower Webview reported ready.");
          // Send initial state if needed
          if (providerInstance && webviewPanel) {
            webviewPanel.webview.postMessage({
              command: "tokenUpdate",
              payload: {
                count: providerInstance.getCurrentTokenCount(),
                isCounting: providerInstance.getIsCounting(),
              },
            });
          }
          return;
        // Add other message handlers from webview...
      }
    },
    undefined, // thisArg
    context.subscriptions // Add disposable to context
  );

  webviewPanel.onDidDispose(
    () => {
      console.log("Prompt Tower UI: Panel disposed."); // Log for debugging
      webviewPanel = undefined;
      // Listener remains active via context.subscriptions
    },
    null, // thisArg
    context.subscriptions // Add disposable to context
  );

  console.log("Prompt Tower UI: Panel created and listeners set."); // Log for debugging

  // --- Send Initial State to newly created panel ---
  // Give the webview a fraction of a second to load its script
  setTimeout(() => {
    if (providerInstance && webviewPanel) {
      console.log("Prompt Tower UI: Sending initial token state.");
      webviewPanel.webview.postMessage({
        command: "tokenUpdate",
        payload: {
          count: providerInstance.getCurrentTokenCount(),
          isCounting: providerInstance.getIsCounting(),
        },
      });
    }
  }, 100); // 100ms delay, adjust if needed
}

export function activate(context: vscode.ExtensionContext) {
  // --- Tree View Setup (Keep if needed) ---
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let treeView: vscode.TreeView<FileItem> | undefined;

  if (rootPath) {
    // Check if the view contribution exists before creating the provider/view
    // Use optional chaining ?. for safety
    const viewContribution = vscode.extensions
      .getExtension(context.extension.id)
      ?.packageJSON?.contributes?.views?.["prompt-tower"]?.find(
        (v: any) => v.id === "promptTowerView"
      );

    if (viewContribution) {
      console.log("Prompt Tower: Initializing Tree View."); // Log for debugging
      providerInstance = new PromptTowerProvider(
        rootPath,
        context,
        tokenUpdateEmitter
      );
      treeView = vscode.window.createTreeView("promptTowerView", {
        treeDataProvider: providerInstance,
        canSelectMany: true,
        showCollapseAll: true,
      });
      context.subscriptions.push(treeView);

      registerCommands(context, providerInstance, treeView);
    } else {
      // Handle case where tree view is not defined in package.json
      console.log(
        "Prompt Tower: Tree View contribution not found. Skipping Tree View setup."
      );
      // Register commands that DON'T depend on the provider/treeView if necessary
      // Ensure registerCommands is called even without provider/treeView for shared commands like config updates
      registerCommands(context);
    }
  } else {
    vscode.window.showInformationMessage(
      "Prompt Tower: No workspace open. Tree view not available."
    );
    // Register commands that DON'T depend on the provider/treeView if necessary
    // Ensure registerCommands is called even without provider/treeView for shared commands like config updates
    registerCommands(context);
  }
  // --- End Tree View Setup ---

  // --- Register Webview Panel Command ---
  console.log("Prompt Tower: Registering command promptTower.showTowerUI"); // Log for debugging
  context.subscriptions.push(
    vscode.commands.registerCommand("promptTower.showTowerUI", () => {
      console.log("Prompt Tower: Command promptTower.showTowerUI executed."); // Log for debugging
      createOrShowWebviewPanel(context);
    })
  );

  // Automatically show the panel upon activation (e.g., when Activity Bar icon is clicked)
  vscode.commands.executeCommand("promptTower.showTowerUI");
}

export function deactivate() {
  console.log('Deactivating "prompt-tower"'); // Log for debugging
  // Dispose the webview panel if it exists
  if (webviewPanel) {
    console.log("Disposing Prompt Tower UI panel."); // Log for debugging
    webviewPanel.dispose();
  }
  // START ADD
  // Dispose the emitter to clean up listeners
  tokenUpdateEmitter.dispose();
  console.log("Disposed token update emitter.");
  // END ADD
}
