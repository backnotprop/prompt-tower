import * as vscode from "vscode";
import { minimatch } from "minimatch";

// import { findMethodSymbol, getNonce, getWorkspaceFiles } from "./utils";

let panel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  const panelCheck = () => {
    if (!panel) {
      panel = createWebviewPanel(context.extensionUri, context);

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === "requestFileContent") {
            const filePath = message.filePath; // Get the file path from the message
            const fileUri = vscode.Uri.file(filePath);

            try {
              const document = await vscode.workspace.openTextDocument(fileUri); // Open the document
              const fileContent = document.getText(); // Read the content of the file

              panel?.webview.postMessage({
                command: "sendText",
                text: fileContent,
                type: "file",
                languageId: document.languageId,
                fileName: document.fileName.split("/").pop(),
              });
            } catch (e) {
              panel?.webview.postMessage({
                command: "error",
                message: "Failed to read file content",
              });
            }
          }
        },
        undefined,
        context.subscriptions
      );

      panel.onDidDispose(
        () => {
          panel = undefined;
        },
        null,
        context.subscriptions
      );
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("prompttower.show", () => {
      if (panel) {
        panel.dispose();
        panel = undefined;
      } else {
        panel = createWebviewPanel(context.extensionUri, context);
        panel.onDidDispose(
          () => {
            panel = undefined;
          },
          null,
          context.subscriptions
        );
      }
    }),

    /**
     * Send the selected text to the webview
     */
    vscode.commands.registerCommand("prompttower.sendText", () => {
      panelCheck();

      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const text = editor.document.getText(editor.selection);

        if (!text || text.length === 0 || text.trim().length === 0) {
          vscode.window.showInformationMessage(
            "Nothing Added! No text selected!"
          );
          return;
        }

        panel?.webview.postMessage({
          command: "sendText",
          text: text,
          type: "selection",
          languageId: editor.document.languageId,
          fileName: editor.document.fileName.split("/").pop(),
        });
      }
    }),

    /**
     * Send the function where the cursor is to the webview
     */
    vscode.commands.registerCommand("prompttower.sendFunction", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      panelCheck();

      const document = editor.document;
      const position = editor.selection.active;

      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >("vscode.executeDocumentSymbolProvider", document.uri);

      if (!symbols) {
        vscode.window.showInformationMessage(
          "Nothing Added! No Function found where cursor is!"
        );
        return;
      }

      let symbolFound = false;

      for (const symbol of symbols) {
        console.log("symbol-------------------");
        console.log(symbol);
        if (
          (symbol.kind === vscode.SymbolKind.Function ||
            symbol.kind === vscode.SymbolKind.Variable) &&
          symbol.range.contains(position)
        ) {
          const functionText = document.getText(symbol.range);
          // await vscode.env.clipboard.writeText(functionText);

          panel?.webview.postMessage({
            command: "sendText",
            text: functionText,
            type: "function",
            languageId: document.languageId,
            fileName: document.fileName.split("/").pop(),
          });

          symbolFound = true;

          break;
        }
      }

      if (!symbolFound) {
        vscode.window.showInformationMessage(
          "Nothing Added! No Function found where cursor is!"
        );
      }
    }),

    /**
     * Send the class where the cursor is to the webview
     */
    vscode.commands.registerCommand("prompttower.sendClass", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      panelCheck();
      const document = editor.document;
      const position = editor.selection.active;

      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >("vscode.executeDocumentSymbolProvider", document.uri);

      if (!symbols) {
        vscode.window.showInformationMessage(
          "Nothing Added! No Class found where cursor is! Error: 1"
        );
        return;
      }

      let symbolFound = false;

      for (const symbol of symbols) {
        if (
          symbol.kind === vscode.SymbolKind.Class &&
          symbol.range.contains(position)
        ) {
          const functionText = document.getText(symbol.range);
          // await vscode.env.clipboard.writeText(functionText);

          panel?.webview.postMessage({
            command: "sendText",
            text: functionText,
            type: "class",
            languageId: document.languageId,
            fileName: document.fileName.split("/").pop(),
          });

          symbolFound = true;

          break;
        }
      }

      if (!symbolFound) {
        vscode.window.showInformationMessage(
          "Nothing Added! No Class found where cursor is! Error 2"
        );
      }
    }),

    /**
     * Send the method where the cursor is to the webview
     */
    vscode.commands.registerCommand("prompttower.sendMethod", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      panelCheck();
      const document = editor.document;
      const position = editor.selection.active;

      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >("vscode.executeDocumentSymbolProvider", document.uri);

      if (!symbols) {
        vscode.window.showInformationMessage(
          "Nothing Added! No Method parent block found where cursor is!"
        );
        return;
      }

      const methodSymbol = findMethodSymbol(symbols, position);
      if (methodSymbol) {
        const functionText = document.getText(methodSymbol.range);
        panel?.webview.postMessage({
          command: "sendText",
          text: functionText,
          type: "method",
          languageId: document.languageId,
          fileName: document.fileName.split("/").pop(),
        });
      } else {
        vscode.window.showInformationMessage(
          "Nothing Added! No Class Method found where cursor is!"
        );
      }
    }),

    /**
     * Send the entire file content to the webview
     */
    vscode.commands.registerCommand("prompttower.sendFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      panelCheck();

      const document = editor.document;
      const entireFileText = document.getText();

      panel?.webview.postMessage({
        command: "sendText",
        text: entireFileText,
        type: "file",
        languageId: document.languageId,
        fileName: document.fileName.split("/").pop(),
      });

      vscode.window.showInformationMessage("File content sent successfully!");
    }),

    /**
     * Enable directory tree select mode
     */
    vscode.commands.registerCommand("prompttower.selectDirectory", async () => {
      panelCheck();
      panel?.webview.postMessage({
        command: "directorySelectModeLoading",
      });

      const fileTree = await getWorkspaceFiles();

      console.log(fileTree, "fileTree");

      panel?.webview.postMessage({
        command: "directorySelectModeLoaded",
        fileTree: fileTree[0].files,
      });
    })
  );
}

function createWebviewPanel(
  extensionUri: vscode.Uri,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "prompttowerPanel",
    "Prompt Tower",

    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "prompt-tower", "release"),
      ],
    }
  );

  panel.webview.html = getWebviewContent(panel.webview, extensionUri);

  return panel;
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "prompt-tower", "release", "index.js")
  );

  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "prompt-tower", "release", "index.css")
  );

  const nonce = getNonce();

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Vite + React + TS</title>
      <link rel="stylesheet" crossorigin href="${styleUri}"  />
      <script type="module" 
      nonce="${nonce}"
      crossorigin src="${scriptUri}"></script>
    </head>
    <body>
      <div id="root"></div>

    </body>
  </html>
  `;
}

export function findMethodSymbol(
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position
): vscode.DocumentSymbol | undefined {
  for (const symbol of symbols) {
    if (
      symbol.range.contains(position) &&
      symbol.kind === vscode.SymbolKind.Method
    ) {
      return symbol;
    }
    // Recurse into children if the symbol has any
    if (symbol.children && symbol.children.length > 0) {
      const found = findMethodSymbol(symbol.children, position);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function getWorkspaceFiles() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  let fileTree = [];

  for (const folder of workspaceFolders) {
    let files = await readDirectory(folder.uri);
    fileTree.push({ folder: folder.name, files });
  }

  return fileTree;
}

interface Node {
  label: string;
  value: string;
  children?: Array<Node>;
}

/**
 * Recursively read the contents of a directory, filter out ignored files based on .gitignore and preset patterns,
 * and return a structured list of file and directory objects formatted as specified.
 * @param uri The URI of the directory to read.
 * @param ignorePatterns An array of minimatch patterns to filter out files and directories.
 * @returns A Promise that resolves to an array of nodes.
 */
export async function readDirectory(
  uri: vscode.Uri,
  ignorePatterns: string[] = [
    "**/.git",
    "**/.vscode",
    "**/.DS_Store",
    "**/node_modules",
    "**/build",
    "**/dist",
    "**/tmp",
    "**/temp",
    "**/*.log",
    "**/.gitignore",
    "**/.gitattributes",
    "**/.gitmodules",
    "**/.gitkeep",
  ]
): Promise<Node[]> {
  const entries = await vscode.workspace.fs.readDirectory(uri);

  // Check for .gitignore in the current directory
  const gitignoreUri = vscode.Uri.joinPath(uri, ".gitignore");
  try {
    const gitignoreContents = await vscode.workspace.fs.readFile(gitignoreUri);
    const additionalPatterns = gitignoreContents
      .toString()
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.trim() !== "");

    ignorePatterns = ignorePatterns.concat(
      additionalPatterns.map((pattern) => "**/" + pattern)
    ); // Ensure patterns are globally applied
  } catch {
    // No .gitignore found or error reading it
  }

  // Filter entries based on ignore patterns from .gitignore and predefined patterns before processing
  const filteredEntries = entries.filter(([name]) => {
    const entryUri = vscode.Uri.joinPath(uri, name).fsPath;
    return !ignorePatterns.some((pattern) =>
      minimatch(entryUri, pattern, { dot: true })
    ); // Enable dot option to include files/folders starting with '.'
  });

  // Map each valid entry to the new Node format
  const nodes = filteredEntries.map(async ([name, type]) => {
    const filePath = vscode.Uri.joinPath(uri, name);

    // Recurse only if the entry is a directory and not filtered out
    if (type === vscode.FileType.Directory) {
      return {
        label: name,
        value: filePath.fsPath,
        children: await readDirectory(filePath, ignorePatterns),
      };
    } else {
      // Otherwise, it's a file
      return {
        label: name,
        value: filePath.fsPath,
        // children: [], // No children for files
      };
    }
  });

  // Wait for all promises in the map to resolve and return the array
  return Promise.all(nodes);
}
