import * as vscode from "vscode";
import { Workspace } from "./Workspace";

/**
 * Represents a file or directory node in the multi-workspace tree
 */
export interface FileNode {
  /** Unique identifier for this node */
  id: string;

  /** Display label for the tree item */
  label: string;

  /** Absolute file system path */
  absolutePath: string;

  /** Path relative to workspace root */
  relativePath: string;

  /** The workspace this node belongs to */
  workspace: Workspace;

  /** Whether this is a file or directory */
  type: "file" | "directory" | "workspace-root";

  /** Whether this node is checked/selected */
  isChecked: boolean;

  /** Whether this node can be checked */
  checkable: boolean;

  /** Child nodes (for directories) */
  children?: FileNode[];

  /** VS Code tree item collapsible state */
  collapsibleState: vscode.TreeItemCollapsibleState;

  /** File extension (for files only) */
  extension?: string;

  /** File size in bytes (for files only) */
  sizeBytes?: number;

  /** Whether this node should be visible in the tree */
  visible: boolean;

  /** Parent node (null for workspace roots) */
  parent?: FileNode;
}

/**
 * Factory for creating FileNode instances
 */
export class FileNodeFactory {
  /**
   * Creates a workspace root node
   */
  static createWorkspaceRoot(workspace: Workspace): FileNode {
    return {
      id: `workspace:${workspace.id}`,
      label: workspace.name,
      absolutePath: workspace.rootPath,
      relativePath: "",
      workspace,
      type: "workspace-root",
      isChecked: false,
      checkable: true,
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      visible: true,
      children: [],
    };
  }

  /**
   * Creates a file node
   */
  static createFileNode(
    absolutePath: string,
    relativePath: string,
    workspace: Workspace,
    parent?: FileNode
  ): FileNode {
    const label =
      absolutePath.split("/").pop() ||
      absolutePath.split("\\").pop() ||
      absolutePath;
    const extension = label.includes(".") ? label.split(".").pop() : undefined;

    return {
      id: `file:${workspace.id}:${relativePath}`,
      label,
      absolutePath,
      relativePath,
      workspace,
      type: "file",
      isChecked: false,
      checkable: true,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      extension,
      visible: true,
      parent,
    };
  }

  /**
   * Creates a directory node
   */
  static createDirectoryNode(
    absolutePath: string,
    relativePath: string,
    workspace: Workspace,
    parent?: FileNode
  ): FileNode {
    const label =
      absolutePath.split("/").pop() ||
      absolutePath.split("\\").pop() ||
      absolutePath;

    return {
      id: `dir:${workspace.id}:${relativePath}`,
      label,
      absolutePath,
      relativePath,
      workspace,
      type: "directory",
      isChecked: false,
      checkable: true,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      visible: true,
      parent,
      children: [],
    };
  }
}

/**
 * Utility functions for working with FileNodes
 */
export class FileNodeUtils {
  /**
   * Gets all descendant file nodes
   */
  static getDescendantFiles(node: FileNode): FileNode[] {
    const files: FileNode[] = [];

    if (node.type === "file") {
      files.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        files.push(...this.getDescendantFiles(child));
      }
    }

    return files;
  }

  /**
   * Gets all checked file nodes
   */
  static getCheckedFiles(nodes: FileNode[]): FileNode[] {
    const checkedFiles: FileNode[] = [];

    for (const node of nodes) {
      if (node.type === "file" && node.isChecked) {
        checkedFiles.push(node);
      }
      if (node.children) {
        checkedFiles.push(...this.getCheckedFiles(node.children));
      }
    }

    return checkedFiles;
  }

  /**
   * Toggles the checked state of a node and its children
   */
  static toggleCheckedState(node: FileNode, checked: boolean): void {
    node.isChecked = checked;

    if (node.children) {
      for (const child of node.children) {
        this.toggleCheckedState(child, checked);
      }
    }
  }

  /**
   * Updates parent checked state based on children
   */
  static updateParentCheckedState(node: FileNode): void {
    if (!node.parent || !node.parent.children) {
      return;
    }

    const checkedChildren = node.parent.children.filter(
      (child) => child.isChecked
    );
    const allChecked = checkedChildren.length === node.parent.children.length;
    const someChecked = checkedChildren.length > 0;

    // For simplicity, parent is checked if all children are checked
    node.parent.isChecked = allChecked;

    // Recurse up the tree
    this.updateParentCheckedState(node.parent);
  }
}
