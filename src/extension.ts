import * as vscode from "vscode";

import { findMethodSymbol, getNonce, getWorkspaceFiles } from "./utils";

let panel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  const panelCheck = () => {
    if (!panel) {
      panel = createWebviewPanel(context.extensionUri, context);
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
        fileTree: fileTree[0].files.map((ft) => {
          if (ft.children && ft.children.length === 0) {
            // return the object without children (no key should be set), not even children:undefined
            const { children, ...rest } = ft;
            return rest;
          }
          return ft;
        }),
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
        vscode.Uri.joinPath(extensionUri, "prompt-tower", "dist"),
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
    vscode.Uri.joinPath(extensionUri, "prompt-tower", "dist", "index.js")
  );

  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "prompt-tower", "dist", "index.css")
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
