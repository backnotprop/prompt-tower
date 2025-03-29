Okay, Agent, here is a step-by-step guide to modify the `prompt-tower` VS Code extension to open its main UI in a Webview Panel (tab) instead of just using the sidebar Tree View. Follow these instructions precisely.

**Goal:** Implement a Webview Panel that opens via a command (`promptTower.showTowerUI`), manages its state (create or reveal), and can be triggered from the Command Palette. The existing Tree View in the sidebar will be kept for now but might become secondary.

---

**Step 1: Modify `package.json`**

* **File:** `package.json`

1.  **Add New Command Definition:**
    * Locate the `contributes.commands` array.
    * Add the following JSON object to the *end* of this array:
        ```json
        {
          "command": "promptTower.showTowerUI",
          "title": "Show Prompt Tower UI",
          "category": "Prompt Tower"
        }
        ```

2.  **Add Activation Event:**
    * Locate the `activationEvents` array.
    * Add the following string to this array:
        ```json
        "onCommand:promptTower.showTowerUI"
        ```
    * The array should now look similar to this (order doesn't strictly matter):
        ```json
        "activationEvents": [
          "onView:promptTowerView",
          "onCommand:promptTower.showTowerUI"
        ],
        ```

3.  **Add Command to Palette:**
    * Locate the `contributes.menus.commandPalette` array.
    * Add the following JSON object to this array (position relative to others doesn't strictly matter, but placing it near other `promptTower` commands is logical):
        ```json
        {
          "command": "promptTower.showTowerUI"
        }
        ```

4.  **Optional: Rename Sidebar View:**
    * Locate the `contributes.views["prompt-tower"]` array. Find the object with `"id": "promptTowerView"`.
    * Change its `"name"` property to indicate its potentially secondary role. For example:
        ```json
        // Before:
        // "name": "Files",
        // After:
        "name": "Files (Legacy)", // Or just "Files" if preferred
        ```
    * *(Self-Correction Note: Skip this name change if you prefer the original name "Files")*

---

**Step 2: Modify `src/extension.ts`**

* **File:** `src/extension.ts`

1.  **Add Imports (if missing):**
    * Ensure `import * as vscode from "vscode";` is present at the top.

2.  **Define Module-Level Variables:**
    * Add these lines *outside* the `activate` function, near the top of the file:
        ```typescript
        // --- Webview Panel Handling ---
        let webviewPanel: vscode.WebviewPanel | undefined;
        const VIEW_TYPE = 'promptTowerUI'; // Unique identifier for the webview panel
        ```

3.  **Add Helper Function `getNonce`:**
    * Add this function *outside* the `activate` function:
        ```typescript
        // Generates a random nonce string for Content Security Policy
        function getNonce() {
            let text = '';
            const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < 32; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        }
        ```

4.  **Add Function `getWebviewContent`:**
    * Add this function *outside* the `activate` function:
        ```typescript
        // Generates the HTML content for the Webview Panel
        function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
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
        ```

5.  **Add Function `createOrShowWebviewPanel`:**
    * Add this function *outside* the `activate` function:
        ```typescript
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
            webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, context.extensionUri);

            // Handle messages from the webview (if you add interactivity)
            webviewPanel.webview.onDidReceiveMessage(
                message => {
                    console.log("Message received from webview:", message); // Log for debugging
                    switch (message.command) {
                        case 'alert':
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
        ```
    * *Self-Correction:* Modified `localResourceRoots` to `[context.extensionUri]` initially to avoid errors if the `media` folder doesn't exist yet. Remind the user to create `media` and adjust `localResourceRoots` if they load local CSS/JS later. Added console logs for easier debugging.

6.  **Modify `activate` Function:**
    * Locate the `activate` function.
    * **Refactor Tree View Initialization:** Wrap the existing tree view initialization code in checks to make it more robust, especially if the view contribution is removed later. Replace the existing tree view setup block with this:
        ```typescript
        // --- Tree View Setup (Keep if needed) ---
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let treeView: vscode.TreeView<FileItem> | undefined;
        let provider: PromptTowerProvider | undefined;

        if (rootPath) {
            // Check if the view contribution exists before creating the provider/view
            // Use optional chaining ?. for safety
            const viewContribution = vscode.extensions.getExtension(context.extension.id)?.packageJSON?.contributes?.views?.['prompt-tower']?.find((v: any) => v.id === 'promptTowerView');

            if (viewContribution) {
                console.log("Prompt Tower: Initializing Tree View."); // Log for debugging
                provider = new PromptTowerProvider(rootPath, context);
                treeView = vscode.window.createTreeView("promptTowerView", {
                    treeDataProvider: provider,
                    canSelectMany: true,
                });

                // Register existing commands associated with the tree view (pass potentially undefined provider/treeView)
                registerCommands(context, provider, treeView); // We'll adjust registerCommands next
            } else {
                // Handle case where tree view is not defined in package.json
                console.log("Prompt Tower: Tree View contribution not found. Skipping Tree View setup.");
                 // Register commands that DON'T depend on the provider/treeView if necessary
                 // Ensure registerCommands is called even without provider/treeView for shared commands like config updates
                 registerCommands(context); // Call with undefined provider/treeView
            }

        } else {
            vscode.window.showInformationMessage("Prompt Tower: No workspace open. Tree view not available.");
             // Register commands that DON'T depend on the provider/treeView if necessary
             // Ensure registerCommands is called even without provider/treeView for shared commands like config updates
             registerCommands(context); // Call with undefined provider/treeView
        }
        // --- End Tree View Setup ---
        ```
    * **Register Webview Command:** Add the following code block *inside* the `activate` function, typically after the Tree View setup:
        ```typescript
        // --- Register Webview Panel Command ---
        console.log("Prompt Tower: Registering command promptTower.showTowerUI"); // Log for debugging
        context.subscriptions.push(
            vscode.commands.registerCommand('promptTower.showTowerUI', () => {
                console.log("Prompt Tower: Command promptTower.showTowerUI executed."); // Log for debugging
                createOrShowWebviewPanel(context);
            })
        );
        ```

7.  **Modify `deactivate` Function:**
    * Locate the `deactivate` function.
    * Add the following code *inside* the function:
        ```typescript
        console.log('Deactivating "prompt-tower"'); // Log for debugging
        // Dispose the webview panel if it exists
        if (webviewPanel) {
            console.log('Disposing Prompt Tower UI panel.'); // Log for debugging
            webviewPanel.dispose();
        }
        ```

---

**Step 3: Modify `src/commands.ts`**

* **File:** `src/commands.ts`

1.  **Update Function Signature:**
    * Change the signature of the `registerCommands` function to accept optional `provider` and `treeView` arguments:
        ```typescript
        // Before:
        // export function registerCommands(
        //  context: vscode.ExtensionContext,
        //  provider: PromptTowerProvider,
        //  treeView: vscode.TreeView<FileItem>
        // ) { ... }

        // After:
        export function registerCommands(
            context: vscode.ExtensionContext,
            provider?: PromptTowerProvider, // Make optional
            treeView?: vscode.TreeView<FileItem> // Make optional
        ) {
            // ... function body ...
        }
        ```

2.  **Conditionally Register Tree View Commands:**
    * Wrap the existing command registrations that depend on `provider` and `treeView` inside an `if` block:
        ```typescript
        // Commands that REQUIRE the provider and treeView
        if (provider && treeView) {
            console.log("Prompt Tower Commands: Registering TreeView specific commands."); // Log for debugging
            context.subscriptions.push(
                treeView.onDidChangeCheckboxState((evt) =>
                    evt.items.forEach(([item]) => provider.toggleCheck(item))
                ),
                vscode.commands.registerCommand("promptTower.refresh", () =>
                    provider.refresh()
                ),
                vscode.commands.registerCommand("promptTower.generateFile", () =>
                    provider.generateFile()
                ),
                vscode.commands.registerCommand("promptTower.toggleAllFiles", () =>
                    provider.toggleAllFiles()
                ),
                vscode.commands.registerCommand("promptTower.checkboxChanged", (item) => {
                    provider.toggleCheck(item);
                })
            );
        } else {
            // Optional: Register dummy commands or show error if these are called without the tree view
             console.log("Prompt Tower Commands: Skipping TreeView specific commands (provider or treeView undefined)."); // Log for debugging
            // Example: Register dummy commands that show a warning
            // const showTreeViewNeededWarning = () => {
            //     vscode.window.showWarningMessage("This command requires the Prompt Tower sidebar view to be enabled and a workspace to be open.");
            // };
            // context.subscriptions.push(
            //      vscode.commands.registerCommand("promptTower.refresh", showTreeViewNeededWarning),
            //      vscode.commands.registerCommand("promptTower.generateFile", showTreeViewNeededWarning),
            //      vscode.commands.registerCommand("promptTower.toggleAllFiles", showTreeViewNeededWarning),
            //      vscode.commands.registerCommand("promptTower.checkboxChanged", showTreeViewNeededWarning)
            // );
        }
        ```

3.  **Ensure Non-Dependent Commands Remain:**
    * Verify that the `vscode.workspace.onDidChangeConfiguration` listener registration is *outside* the `if (provider && treeView)` block, so it always gets registered. It should look like this:
        ```typescript
            // ... (end of the if/else block from previous substep) ...

            // Commands that DON'T require the provider/treeView (like config changes)
            console.log("Prompt Tower Commands: Registering configuration change listener."); // Log for debugging
            context.subscriptions.push(
                vscode.workspace.onDidChangeConfiguration((evt) => {
                    // ... (rest of the existing configuration handling code) ...
                })
            );
        } // End of registerCommands function
        ```
    * *Self-Correction:* Added console logs for easier debugging of command registration. Commented out the dummy command registration in the `else` block to avoid unnecessary complexity initially, but kept the structure.
