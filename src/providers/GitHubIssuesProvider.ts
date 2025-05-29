import * as vscode from "vscode";

export class GitHubIssue extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly number: number,
    public readonly state: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(title, collapsibleState);
    
    this.label = `#${number}: ${title}`;
    this.tooltip = `Issue #${number}: ${title} (${state})`;
    this.contextValue = "githubIssue";
    
    // Set icon based on issue state
    this.iconPath = new vscode.ThemeIcon(
      state === "open" ? "issues" : "issue-closed"
    );
  }
}

export class GitHubIssuesProvider implements vscode.TreeDataProvider<GitHubIssue> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GitHubIssue | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GitHubIssue | undefined | void> = this._onDidChangeTreeData.event;

  private issues: GitHubIssue[] = [];

  constructor() {
    // Mock data for now
    this.issues = [
      new GitHubIssue("Add dark mode support", 1, "open", vscode.TreeItemCollapsibleState.None),
      new GitHubIssue("Fix memory leak in file watcher", 2, "closed", vscode.TreeItemCollapsibleState.None),
      new GitHubIssue("Improve token counting performance", 3, "open", vscode.TreeItemCollapsibleState.None),
    ];
  }

  getTreeItem(element: GitHubIssue): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GitHubIssue): Thenable<GitHubIssue[]> {
    if (!element) {
      // Return root items (the issues)
      return Promise.resolve(this.issues);
    }
    
    // No children for individual issues for now
    return Promise.resolve([]);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // Method to add new issues (you'll implement GitHub API integration later)
  addIssue(title: string, number: number, state: string): void {
    const issue = new GitHubIssue(title, number, state, vscode.TreeItemCollapsibleState.None);
    this.issues.push(issue);
    this.refresh();
  }
}