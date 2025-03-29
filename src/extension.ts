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
            /* Add these if not already present or modify existing */
            display: flex;
            flex-direction: column;
            height: 100vh; /* Use full viewport height */
            box-sizing: border-box;
        }
        h1 {
            margin-top: 0;
            font-size: 1.5em; /* Adjust as needed */
            border-bottom: 1px solid var(--vscode-separator-foreground);
            padding-bottom: 0.3em;
            margin-bottom: 0.8em;
        }
        #token-info {
            margin-bottom: 15px;
            padding: 10px 12px;
            border: 1px solid var(--vscode-editorWidget-border, #ccc);
            border-radius: 4px;
            background-color: var(--vscode-editorWidget-background, #f0f0f0);
            display: flex; /* Use flexbox for alignment */
            align-items: center; /* Vertically align items */
            gap: 8px; /* Space between items */
            margin-bottom: 1em; /* Add margin below token info */
            flex-shrink: 0; /* Prevent token info from shrinking */
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
            margin: 1em 0; /* Adjusted margin */
            width: 100%;
            flex-shrink: 0; /* Prevent hr from shrinking */
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
        textarea {
          /* Use VS Code text area styles */
          width: 100%; /* Take full width */
          box-sizing: border-box; /* Include padding/border in width */
          padding: 8px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-input-foreground);
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border, var(--vscode-contrastBorder));
          border-radius: 2px;
          min-height: 80px; /* Minimum height */
          resize: vertical; /* Allow vertical resize */
        }
        textarea:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
          border-color: var(--vscode-focusBorder);
        }
        /* Ensure text areas take available space */
        #prompt-prefix-container,
        #prompt-suffix-container {
          /* Define flex grow/shrink/basis if needed for more complex layouts */
          min-height: 100px; /* Give them some initial height */
        }
        #prompt-prefix,
        #prompt-suffix {
          flex-grow: 1; /* Allow textareas to grow */
        }
        #action-button-container {
          margin-top: auto; /* Push button to the bottom */
          padding-top: 1em; /* Add some space above the button */
          flex-shrink: 0; /* Prevent button container from shrinking */
          border-top: 1px solid var(--vscode-separator-foreground); /* Optional separator */
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

            <div style="width: 100%; height: 5px; background-color: var(--vscode-editorWidget-border); margin-bottom: 20px;"></div>

            <div id="prompt-prefix-container" class="textarea-container">
              <label for="prompt-prefix">Prompt Prefix (Prepended to export)</label>
              <textarea id="prompt-prefix">${initialPrefix}</textarea>
            </div>

            <div id="prompt-suffix-container" class="textarea-container">
              <label for="prompt-suffix">Prompt Suffix (Appended to export)</label>
              <textarea id="prompt-suffix">${initialSuffix}</textarea>
            </div>

            <p>Additional controls and prompt preview will go here.</p>
            <div id="action-button-container">
              <button id="copyButton">Create Context and Copy to Clipboard</button>
            </div>
            <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi(); // Get VS Code API access

                    // Get state object (will be undefined first time, so initialize empty)
                    const state = vscode.getState() || {};

                    // --- Get references to elements ---
                    const tokenCountElement = document.getElementById('token-count');
                    const tokenStatusElement = document.getElementById('token-status');
                    const spinnerElement = document.getElementById('spinner');
                    const prefixTextArea = document.getElementById("prompt-prefix");
                    const suffixTextArea = document.getElementById("prompt-suffix");
                    const copyButton = document.getElementById('copyButton');

                    // --- Restore state if available ---
                    if (prefixTextArea && state.promptPrefix) {
                      prefixTextArea.value = state.promptPrefix;
                    }
                    if (suffixTextArea && state.promptSuffix) {
                      suffixTextArea.value = state.promptSuffix;
                    }

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

                            // Handle initial/updated prefix/suffix from extension
                            case 'updatePrefix':
                                if (prefixTextArea && typeof message.text === 'string') {
                                    prefixTextArea.value = message.text;
                                    // Update state
                                    state.promptPrefix = message.text;
                                    vscode.setState(state);
                                }
                                break;
                            case 'updateSuffix':
                                 if (suffixTextArea && typeof message.text === 'string') {
                                    suffixTextArea.value = message.text;
                                     // Update state
                                     state.promptSuffix = message.text;
                                     vscode.setState(state);
                                }
                                break;
                        }
                    });

                    // --- Event Listeners for Text Area Input ---
                    if (prefixTextArea) {
                      prefixTextArea.addEventListener("input", (e) => {
                        const text = e.target.value;
                        vscode.postMessage({ command: "updatePrefix", text: text });
                        // Persist state within webview
                        state.promptPrefix = text;
                        vscode.setState(state);
                      });
                    }
                    if (suffixTextArea) {
                      suffixTextArea.addEventListener("input", (e) => {
                        const text = e.target.value;
                        vscode.postMessage({ command: "updateSuffix", text: text });
                        // Persist state within webview
                        state.promptSuffix = text;
                        vscode.setState(state);
                      });
                    }

                    // --- Event Listener for Copy Button ---
                    if (copyButton) {
                      copyButton.addEventListener("click", () => {
                        vscode.postMessage({
                          command: "copyToClipboard", // Send new command
                        });
                      });
                    }

                    // --- Optional: Notify Extension when Webview is Ready ---
                    // Useful if the extension needs to know when to send initial data.
                    vscode.postMessage({ command: "webviewReady" });
                    console.log("Webview script loaded and ready.");

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
    // Resend state when revealed
    if (providerInstance) {
      webviewPanel.webview.postMessage({
        command: "updatePrefix",
        text: providerInstance.getPromptPrefix(),
      });
      webviewPanel.webview.postMessage({
        command: "updateSuffix",
        text: providerInstance.getPromptSuffix(),
      });
      webviewPanel.webview.postMessage({
        command: "tokenUpdate",
        payload: {
          count: providerInstance.getCurrentTokenCount(),
          isCounting: providerInstance.getIsCounting(),
        },
      });
    }
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
      enableCommandUris: true, // Might be needed for state persistence or other commands
    }
  );

  // Get initial state from provider before setting HTML
  let initialPrefix = "";
  let initialSuffix = "";
  if (providerInstance) {
    initialPrefix = providerInstance.getPromptPrefix();
    initialSuffix = providerInstance.getPromptSuffix();
  }
  webviewPanel.webview.html = getWebviewContent(
    webviewPanel.webview,
    context.extensionUri,
    initialPrefix,
    initialSuffix
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
        case "updatePrefix":
          if (providerInstance && typeof message.text === "string") {
            providerInstance.setPromptPrefix(message.text);
          }
          return;
        case "updateSuffix":
          if (providerInstance && typeof message.text === "string") {
            providerInstance.setPromptSuffix(message.text);
          }
          return;
        case "webviewReady": // Handle webview ready message
          console.log("Prompt Tower Webview reported ready.");
          // Send initial state (already handled by setting HTML, but could be resent here)
          if (providerInstance && webviewPanel) {
            // Resend state just in case initialization timing was off
            webviewPanel.webview.postMessage({
              command: "updatePrefix",
              text: providerInstance.getPromptPrefix(),
            });
            webviewPanel.webview.postMessage({
              command: "updateSuffix",
              text: providerInstance.getPromptSuffix(),
            });
            webviewPanel.webview.postMessage({
              command: "tokenUpdate",
              payload: {
                count: providerInstance.getCurrentTokenCount(),
                isCounting: providerInstance.getIsCounting(),
              },
            });
          }
          return;
        // --- NEW: Handle copy command ---
        case "copyToClipboard":
          if (providerInstance) {
            // Call the new provider method
            providerInstance.copyContextToClipboard();
          } else {
            vscode.window.showErrorMessage(
              "Prompt Tower provider not available."
            );
          }
          return;
        // --- End NEW ---
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
  // Dispose the emitter to clean up listeners
  tokenUpdateEmitter.dispose();
  console.log("Disposed token update emitter.");
}
