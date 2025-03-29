// src/extension.ts

import * as vscode from "vscode";
import { PromptTowerProvider } from "./providers/PromptTowerProvider";
import { registerCommands } from "./commands";
import { FileItem } from "./models/FileItem";

// --- Webview Panel Handling ---
let webviewPanel: vscode.WebviewPanel | undefined;
const VIEW_TYPE = "promptTowerUI"; // Unique identifier for the webview panel

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
  // Example: Load a stylesheet (create this file: media/style.css)
  // const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
  // Example: Load a script (create this file: media/main.js)
  // const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));

  // Use a nonce for Content Security Policy
  const nonce = getNonce();

  return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${webview.cspSource} 'unsafe-inline';
                img-src ${webview.cspSource} https:;
                script-src 'nonce-${nonce}';
            ">

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>Prompt Tower UI</title>
        </head>
        <body>
            <h1>Welcome to Prompt Tower!</h1>
            <p>This is your main UI tab.</p>
            <p>You can build your mini-web application here using HTML, CSS, and JavaScript.</p>

            <button id="testButton">Show Error Message</button>

            <script nonce="${nonce}">
                // Example script to communicate from webview to extension
                const vscode = acquireVsCodeApi(); // Get VS Code API access

                document.getElementById('testButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'alert',
                        text: 'Button clicked in Webview!'
                    });
                });

                // You can also receive messages from the extension here if needed
                // window.addEventListener('message', event => {
                //     const message = event.data; // The JSON data that the extension sent
                //     switch (message.command) {
                //         case 'refactor':
                //             // ... handle message ...
                //             break;
                //     }
                // });
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

      // Restrict the webview to only loading content from our extension's `media` directory.
      // !! IMPORTANT: Create a 'media' folder in your project root if you uncomment resource loading !!
      // localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      localResourceRoots: [context.extensionUri], // Allow loading from extension root for now

      // Optional: Retain context when hidden (good for complex web apps)
      // retainContextWhenHidden: true,
    }
  );

  // Set the webview's initial html content
  webviewPanel.webview.html = getWebviewContent(
    webviewPanel.webview,
    context.extensionUri
  );

  // Handle messages from the webview (if you add interactivity)
  webviewPanel.webview.onDidReceiveMessage(
    (message) => {
      console.log("Message received from webview:", message); // Log for debugging
      switch (message.command) {
        case "alert":
          vscode.window.showErrorMessage(message.text);
          return;
        // Add other message handlers...
      }
    },
    undefined,
    context.subscriptions
  );

  // Reset the panel variable when the panel is closed
  webviewPanel.onDidDispose(
    () => {
      console.log("Prompt Tower UI: Panel disposed."); // Log for debugging
      webviewPanel = undefined;
    },
    null,
    context.subscriptions
  );
  console.log("Prompt Tower UI: Panel created and listeners set."); // Log for debugging
}

export function activate(context: vscode.ExtensionContext) {
  // --- Tree View Setup (Keep if needed) ---
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let treeView: vscode.TreeView<FileItem> | undefined;
  let provider: PromptTowerProvider | undefined;

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
      provider = new PromptTowerProvider(rootPath, context);
      treeView = vscode.window.createTreeView("promptTowerView", {
        treeDataProvider: provider,
        canSelectMany: true,
      });

      // Register existing commands associated with the tree view (pass potentially undefined provider/treeView)
      registerCommands(context, provider, treeView);
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
}

export function deactivate() {
  console.log('Deactivating "prompt-tower"'); // Log for debugging
  // Dispose the webview panel if it exists
  if (webviewPanel) {
    console.log("Disposing Prompt Tower UI panel."); // Log for debugging
    webviewPanel.dispose();
  }
}
