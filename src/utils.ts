import * as vscode from "vscode";
import { minimatch } from "minimatch";

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

export const uniqueId = (length = 16) => {
  return parseInt(
    Math.ceil(Math.random() * Date.now())
      .toPrecision(length)
      .toString()
      .replace(".", "")
  );
};

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

/**
 * Recursively read the contents of a directory, filter out ignored files based on .gitignore,
 * and return a structured list of files and directories.
 * @param uri The URI of the directory to read.
 * @param ignorePatterns An array of minimatch patterns to filter out files and directories.
 * @returns A Promise that resolves to an array of file and directory objects formatted as specified.
 */
export async function readDirectory(
  uri: vscode.Uri,
  ignorePatterns: string[] = []
): Promise<
  Array<{
    value: string;
    text: string;
    status: boolean;
    id: number;
    nodes: Array<any>;
  }>
> {
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
      additionalPatterns.map(
        (pattern) => vscode.Uri.joinPath(uri, pattern).fsPath
      )
    );
  } catch {
    // No .gitignore found or error reading it
  }

  // Filter entries based on ignore patterns from .gitignore
  const filteredEntries = entries.filter(
    ([name]) =>
      !ignorePatterns.some((pattern) =>
        minimatch(vscode.Uri.joinPath(uri, name).fsPath, pattern)
      )
  );

  const items = filteredEntries.map(async ([name, type]) => {
    const filePath = vscode.Uri.joinPath(uri, name);

    // If the entry is a directory, recurse into it
    if (type === vscode.FileType.Directory) {
      return {
        value: name,
        text: name,
        status: false,
        id: uniqueId(),
        nodes: await readDirectory(filePath, ignorePatterns),
      };
    } else {
      // Otherwise, it's a file
      return {
        value: name,
        text: name,
        status: false,
        id: uniqueId(),
        nodes: [],
      };
    }
  });

  return Promise.all(items);
}