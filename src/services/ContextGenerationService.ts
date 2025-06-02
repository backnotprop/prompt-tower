import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { FileNode, FileNodeUtils } from "../models/FileNode";
import { ContextConfig } from "../models/Workspace";
import { generateFileStructureTree } from "../utils/fileTree";

/**
 * Result of context generation
 */
export interface ContextGenerationResult {
  contextString: string;
  fileCount: number;
  tokenCount?: number;
}

/**
 * Structured file path for tree generation
 */
interface StructuredFilePath {
  origin: string;
  tree: string;
}

/**
 * Service for generating context strings from selected files
 */
export class ContextGenerationService {
  private config!: ContextConfig; // Use definite assignment assertion
  private gitHubIssuesProvider?: any;

  constructor() {
    this.loadConfiguration();
    this.setupConfigurationWatcher();
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration("promptTower");

    const outputFormat = config.get<any>("outputFormat") || {};
    const projectTreeFormat =
      config.get<any>("outputFormat.projectTreeFormat") || {};
    const wrapperFormat = config.get<any>("outputFormat.wrapperFormat");

    this.config = {
      blockTemplate:
        outputFormat.blockTemplate ||
        '<file name="{fileNameWithExtension}" path="{rawFilePath}">\n{fileContent}\n</file>',
      blockSeparator: outputFormat.blockSeparator || "\n",
      blockTrimLines: outputFormat.blockTrimLines ?? true,
      wrapperTemplate:
        wrapperFormat === null
          ? null
          : wrapperFormat?.template ||
            "<context>\n{githubIssues}{treeBlock}<project_files>\n{blocks}\n</project_files>\n</context>",
      projectTree: {
        enabled: projectTreeFormat.enabled ?? true,
        type: projectTreeFormat.type || "fullFilesAndDirectories",
        showFileSize: projectTreeFormat.showFileSize ?? false,
        template: "<project_tree>\n{projectTree}\n</project_tree>\n",
      },
      promptPrefix: "",
      promptSuffix: "",
      maxFileSizeWarningKB: config.get<number>("maxFileSizeWarningKB", 500),
    };
  }

  /**
   * Setup configuration change watcher
   */
  private setupConfigurationWatcher(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("promptTower.outputFormat")) {
        this.loadConfiguration();
      }
    });
  }

  /**
   * Generate context string from file nodes
   */
  async generateContext(
    fileNodes: FileNode[],
    options?: {
      prefix?: string;
      suffix?: string;
      primaryWorkspaceRoot?: string;
    }
  ): Promise<ContextGenerationResult> {
    const checkedFiles = FileNodeUtils.getCheckedFiles(fileNodes);
    const fileCount = checkedFiles.length;

    // Check if we have GitHub issues selected
    let hasSelectedIssues = false;
    if (this.gitHubIssuesProvider) {
      try {
        const selectedIssues =
          await this.gitHubIssuesProvider.getSelectedIssueDetails();
        hasSelectedIssues = selectedIssues && selectedIssues.size > 0;
      } catch (error) {
        console.error("Error checking GitHub issues:", error);
      }
    }

    if (fileCount === 0 && !hasSelectedIssues) {
      // If project tree is enabled and configured to show all files, generate tree-only context
      if (
        this.config.projectTree.enabled &&
        (this.config.projectTree.type === "fullFilesAndDirectories" ||
          this.config.projectTree.type === "fullDirectoriesOnly")
      ) {
        const fileTree = await this.generateProjectTree(
          fileNodes,
          options?.primaryWorkspaceRoot
        );
        let treeOnlyContext = this.config.projectTree.template.replace(
          "{projectTree}",
          fileTree
        );

        if (options?.prefix) {
          treeOnlyContext = options.prefix + "\n" + treeOnlyContext;
        }
        if (options?.suffix) {
          treeOnlyContext = treeOnlyContext + "\n" + options.suffix;
        }

        return { contextString: treeOnlyContext, fileCount: 0 };
      }

      return { contextString: "", fileCount: 0 };
    }

    try {
      // Generate file blocks concurrently
      const fileBlockPromises =
        fileCount > 0
          ? checkedFiles.map((node) => this.generateFileBlock(node))
          : [];

      // Generate project tree
      const projectTreePromise = this.generateProjectTree(
        fileNodes,
        options?.primaryWorkspaceRoot
      );

      // Generate GitHub issues if provider is available
      const githubIssuesPromise = this.generateGitHubIssuesBlocks();

      // Wait for all processing to complete
      const [fileTree, githubIssuesBlocks, ...fileBlocks] = await Promise.all([
        projectTreePromise,
        githubIssuesPromise,
        ...fileBlockPromises,
      ]);

      // Join file blocks
      const joinedFileBlocks = fileBlocks.join(this.config.blockSeparator);

      // Join GitHub issues
      const joinedGithubIssues =
        githubIssuesBlocks.length > 0
          ? githubIssuesBlocks.join(this.config.blockSeparator)
          : "";

      // Apply wrapper template
      let finalContext = this.applyWrapperTemplate(
        joinedFileBlocks,
        joinedGithubIssues,
        fileTree,
        fileCount
      );

      // Add prefix and suffix
      if (options?.prefix) {
        finalContext = options.prefix + "\n" + finalContext;
      }
      if (options?.suffix) {
        if (finalContext.length > 0 && !finalContext.endsWith("\n")) {
          finalContext += "\n";
        }
        finalContext += options.suffix;
      }

      return {
        contextString: finalContext,
        fileCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Error generating context string: ${errorMessage}`);
    }
  }

  /**
   * Generate a formatted block for a single file
   */
  private async generateFileBlock(fileNode: FileNode): Promise<string> {
    try {
      // Read file content
      const fileContent = await fs.promises.readFile(
        fileNode.absolutePath,
        "utf8"
      );

      // Calculate paths and names
      const fileNameWithExtension = path.basename(fileNode.absolutePath);
      const fileExtension = path.extname(fileNode.absolutePath);
      const fileName = path.basename(fileNode.absolutePath, fileExtension);

      // Create source path (relative to workspace with leading slash)
      const sourcePath = "/" + fileNode.relativePath.replace(/\\/g, "/");

      // Apply block template
      let formattedBlock = this.config.blockTemplate;

      // Replace placeholders
      formattedBlock = formattedBlock.replace(
        /{fileNameWithExtension}/g,
        fileNameWithExtension
      );
      formattedBlock = formattedBlock.replace(/{rawFilePath}/g, sourcePath);
      formattedBlock = formattedBlock.replace(/{fileName}/g, fileName);
      formattedBlock = formattedBlock.replace(
        /{fileExtension}/g,
        fileExtension
      );
      formattedBlock = formattedBlock.replace(
        /{fullPath}/g,
        fileNode.absolutePath
      );

      // Trim file content if configured
      let trimmedFileContent = fileContent;
      if (this.config.blockTrimLines) {
        trimmedFileContent = trimmedFileContent.replace(/^(\s*\r?\n)+/, ""); // Remove leading blank lines
        trimmedFileContent = trimmedFileContent.replace(/(\r?\n\s*)+$/, ""); // Remove trailing blank lines
      }

      // Replace file content last to avoid issues with content containing placeholders
      formattedBlock = formattedBlock.replace(
        /{fileContent}/g,
        trimmedFileContent
      );

      return formattedBlock;
    } catch (error) {
      console.error(
        `Error generating block for file ${fileNode.absolutePath}:`,
        error
      );
      return `<!-- Error reading file: ${fileNode.relativePath} -->`;
    }
  }

  /**
   * Generate project tree structure
   */
  private async generateProjectTree(
    fileNodes: FileNode[],
    primaryWorkspaceRoot?: string
  ): Promise<string> {
    if (!this.config.projectTree.enabled) {
      return "";
    }

    let filesToInclude: StructuredFilePath[];

    if (this.config.projectTree.type === "selectedFilesOnly") {
      // Use only selected files
      const checkedFiles = FileNodeUtils.getCheckedFiles(fileNodes);
      filesToInclude = checkedFiles.map((node) => ({
        origin: node.absolutePath,
        tree: node.relativePath,
      }));
    } else {
      // Use all files from all workspaces
      filesToInclude = await this.getAllWorkspaceFiles(fileNodes);
    }

    // Determine workspace root for tree generation
    const workspaceRoot =
      primaryWorkspaceRoot || this.determinePrimaryWorkspaceRoot(fileNodes);

    return generateFileStructureTree(
      workspaceRoot,
      filesToInclude,
      undefined, // Use default print lines limit
      {
        showFileSize:
          this.config.projectTree.type === "fullDirectoriesOnly"
            ? false
            : this.config.projectTree.showFileSize,
      }
    );
  }

  /**
   * Get all files from all workspaces
   */
  private async getAllWorkspaceFiles(
    fileNodes: FileNode[]
  ): Promise<StructuredFilePath[]> {
    const allFiles: StructuredFilePath[] = [];

    for (const rootNode of fileNodes) {
      if (rootNode.type === "workspace-root") {
        this.collectFilesFromNode(rootNode, allFiles);
      }
    }

    return allFiles;
  }

  /**
   * Recursively collect files from a node
   */
  private collectFilesFromNode(
    node: FileNode,
    files: StructuredFilePath[]
  ): void {
    if (node.type === "file") {
      files.push({
        origin: node.absolutePath,
        tree: node.relativePath,
      });
    } else if (
      node.type === "directory" &&
      this.config.projectTree.type === "fullDirectoriesOnly"
    ) {
      files.push({
        origin: node.absolutePath + "/",
        tree: node.relativePath + "/",
      });
    }

    if (node.children) {
      for (const child of node.children) {
        this.collectFilesFromNode(child, files);
      }
    }
  }

  /**
   * Determine the primary workspace root from file nodes
   */
  private determinePrimaryWorkspaceRoot(fileNodes: FileNode[]): string {
    for (const node of fileNodes) {
      if (node.type === "workspace-root") {
        return node.workspace.rootPath;
      }
    }
    return process.cwd(); // Fallback
  }

  /**
   * Apply wrapper template with all substitutions
   */
  private applyWrapperTemplate(
    fileBlocks: string,
    githubIssues: string,
    projectTree: string,
    fileCount: number
  ): string {
    if (!this.config.wrapperTemplate) {
      // No wrapper - combine directly
      if (githubIssues && fileBlocks) {
        return githubIssues + this.config.blockSeparator + fileBlocks;
      } else if (githubIssues) {
        return githubIssues;
      } else {
        return fileBlocks;
      }
    }

    let wrapped = this.config.wrapperTemplate;

    // Create tree block
    const treeBlock = this.config.projectTree.enabled
      ? this.config.projectTree.template.replace("{projectTree}", projectTree)
      : "";

    // Create GitHub issues section
    const githubIssuesSection = githubIssues ? `${githubIssues}\n` : "";

    // Replace all placeholders
    wrapped = wrapped.replace(/{treeBlock}/g, treeBlock);
    wrapped = wrapped.replace(/{githubIssues}/g, githubIssuesSection);
    wrapped = wrapped.replace(/{blocks}/g, fileBlocks);
    wrapped = wrapped.replace(/{timestamp}/g, new Date().toISOString());
    wrapped = wrapped.replace(/{fileCount}/g, String(fileCount));
    wrapped = wrapped.replace(/{outputFileName}/g, "clipboard-content");

    return wrapped;
  }

  /**
   * Copy context to clipboard
   */
  async copyToClipboard(
    fileNodes: FileNode[],
    options?: {
      prefix?: string;
      suffix?: string;
      primaryWorkspaceRoot?: string;
    }
  ): Promise<ContextGenerationResult> {
    try {
      const result = await this.generateContext(fileNodes, options);

      if (result.fileCount === 0 && !result.contextString) {
        vscode.window.showWarningMessage(
          "No files selected or prefix/suffix entered to copy!"
        );
        return result;
      }

      await vscode.env.clipboard.writeText(result.contextString);

      vscode.window.showInformationMessage(
        `Success: Copied context for ${result.fileCount} files to clipboard.`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        `Error copying context to clipboard: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Update configuration (for external updates)
   */
  updateConfig(updates: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextConfig {
    return { ...this.config };
  }

  /**
   * Set the GitHub issues provider for integration
   */
  setGitHubIssuesProvider(provider: any): void {
    this.gitHubIssuesProvider = provider;
  }

  /**
   * Generate formatted blocks for selected GitHub issues
   */
  private async generateGitHubIssuesBlocks(): Promise<string[]> {
    if (!this.gitHubIssuesProvider) {
      return [];
    }

    try {
      const selectedIssues =
        await this.gitHubIssuesProvider.getSelectedIssueDetails();

      if (selectedIssues.size === 0) {
        return [];
      }

      const blocks: string[] = [];

      for (const [issueNumber, details] of selectedIssues) {
        const { issue, comments } = details;

        let issueBlock = `<github_issue number="${issue.number}" state="${issue.state}">
<title>${issue.title}</title>
<url>${issue.html_url}</url>
<created_at>${issue.created_at}</created_at>
<author>${issue.user.login}</author>`;

        if (issue.labels.length > 0) {
          const labelNames = issue.labels.map((l: any) => l.name).join(", ");
          issueBlock += `\n<labels>${labelNames}</labels>`;
        }

        if (issue.body) {
          issueBlock += `\n<body>\n${issue.body}\n</body>`;
        }

        if (comments.length > 0) {
          issueBlock += `\n<comments>`;
          for (const comment of comments) {
            issueBlock += `\n<comment author="${comment.user.login}" created_at="${comment.created_at}">
${comment.body}
</comment>`;
          }
          issueBlock += `\n</comments>`;
        }

        issueBlock += `\n</github_issue>`;
        blocks.push(issueBlock);
      }

      return blocks;
    } catch (error) {
      console.error("Error generating GitHub issues blocks:", error);
      return [];
    }
  }
}
