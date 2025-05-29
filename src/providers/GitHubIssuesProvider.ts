import * as vscode from "vscode";
import { GitHubApiClient, GitHubIssue as ApiIssue, GitHubComment } from "../api/GitHubApiClient";
import { GitHubConfigManager } from "../utils/githubConfig";
import { encode } from "gpt-tokenizer";

export class GitHubIssue extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly number: number,
    public readonly state: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly isSpecialItem: boolean = false
  ) {
    super(title, collapsibleState);
    
    if (isSpecialItem) {
      // Special items like loading, error messages
      this.label = title;
      this.contextValue = "githubSpecialItem";
      this.iconPath = new vscode.ThemeIcon(this.getSpecialIcon());
    } else {
      // Regular issue items
      this.label = `#${number}: ${title}`;
      this.tooltip = `Issue #${number}: ${title} (${state})`;
      this.contextValue = "githubIssue";
      this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
      
      // Set icon based on issue state
      this.iconPath = new vscode.ThemeIcon(
        state === "open" ? "issues" : "issue-closed"
      );
    }
  }

  private getSpecialIcon(): string {
    switch (this.state) {
      case "loading": return "loading~spin";
      case "error": return "error";
      case "info": return "info";
      case "auth": return "lock";
      default: return "circle-slash";
    }
  }
}

interface CachedIssueData {
  issue: ApiIssue;
  comments: GitHubComment[];
  tokenCount: number;
  fetchedAt: Date;
}

export interface IssueTokenUpdate {
  totalTokens: number;
  selectedCount: number;
  isCounting: boolean;
}

export class GitHubIssuesProvider implements vscode.TreeDataProvider<GitHubIssue> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GitHubIssue | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GitHubIssue | undefined | void> = this._onDidChangeTreeData.event;
  
  private _onDidChangeTokens = new vscode.EventEmitter<IssueTokenUpdate>();
  readonly onDidChangeTokens: vscode.Event<IssueTokenUpdate> = this._onDidChangeTokens.event;

  private issues: GitHubIssue[] = [];
  private loaded = false;
  private isLoading = false;
  private errorMessage?: string;
  private selectedIssues = new Set<number>();
  private apiClient?: GitHubApiClient;
  private repoInfo?: { owner: string; repo: string };
  
  // Caching for issue details
  private issueCache = new Map<number, CachedIssueData>();
  private totalIssueTokens = 0;
  private activeFetches = new Set<number>();

  constructor(
    private context: vscode.ExtensionContext,
    private workspaceRoot: string
  ) {}

  getTreeItem(element: GitHubIssue): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GitHubIssue): Promise<GitHubIssue[]> {
    if (!element) {
      // Root level - show issues or loading state
      if (!this.loaded && !this.isLoading) {
        // First time - load issues
        await this.loadIssues();
      }
      
      if (this.isLoading) {
        return [new GitHubIssue("Loading issues...", -1, "loading", vscode.TreeItemCollapsibleState.None, true)];
      }
      
      if (this.errorMessage) {
        return [new GitHubIssue(this.errorMessage, -1, "error", vscode.TreeItemCollapsibleState.None, true)];
      }
      
      if (this.issues.length === 0) {
        return [new GitHubIssue("No open issues", -1, "info", vscode.TreeItemCollapsibleState.None, true)];
      }
      
      return this.issues;
    }
    
    // No children for individual issues
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadIssues(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = undefined;
    this.refresh();
    
    try {
      // Auto-detect repository info if not already done
      if (!this.repoInfo) {
        const detected = await GitHubConfigManager.detectRepoInfo(this.workspaceRoot);
        if (!detected || !detected.isGitHub) {
          this.errorMessage = "Not a GitHub repository";
          return;
        }
        this.repoInfo = { owner: detected.owner, repo: detected.repo };
      }
      
      // Initialize API client
      if (!this.apiClient) {
        this.apiClient = new GitHubApiClient(
          this.context,
          this.repoInfo.owner,
          this.repoInfo.repo
        );
        await this.apiClient.initialize();
      }
      
      // Fetch issues from GitHub
      const apiIssues = await this.apiClient.listIssues('open', 100);
      
      // Convert API issues to tree items
      this.issues = apiIssues
        .filter((issue: ApiIssue) => !issue.html_url.includes('/pull/')) // Filter out PRs
        .map((issue: ApiIssue) => {
          const treeItem = new GitHubIssue(
            issue.title,
            issue.number,
            issue.state,
            vscode.TreeItemCollapsibleState.None
          );
          
          // Add additional info as description
          const labels = issue.labels.map(l => l.name).join(', ');
          const commentInfo = issue.comments > 0 ? `${issue.comments} comments` : '';
          const parts = [labels, commentInfo].filter(p => p).join(' • ');
          if (parts) {
            treeItem.description = parts;
          }
          
          return treeItem;
        });
      
      // Check if we hit the 100 limit
      if (apiIssues.length === 100) {
        this.issues.push(
          new GitHubIssue(
            "Showing 100 most recent issues",
            -1,
            "info",
            vscode.TreeItemCollapsibleState.None,
            true
          )
        );
      }
      
    } catch (error: any) {
      if (error.status === 404) {
        this.errorMessage = "Repository not found or private";
      } else if (error.status === 401) {
        this.errorMessage = "Authentication required for private repository";
      } else if (error.status === 403) {
        this.errorMessage = "GitHub API rate limit exceeded";
      } else if (error.message) {
        this.errorMessage = error.message;
      } else {
        this.errorMessage = "Failed to load issues";
      }
      console.error("Error loading GitHub issues:", error);
    } finally {
      this.loaded = true; // Always set to true to prevent infinite loops
      this.isLoading = false;
      this.refresh();
    }
  }

  async reloadIssues(): Promise<void> {
    this.loaded = false;
    this.issues = [];
    this.issueCache.clear(); // Clear cached data
    this.selectedIssues.clear(); // Clear selections
    this.updateTokenCount(); // Reset token count
    await this.loadIssues();
  }

  async toggleIssueSelection(issue: GitHubIssue): Promise<void> {
    if (issue.isSpecialItem || issue.number < 0) {
      return;
    }
    
    if (this.selectedIssues.has(issue.number)) {
      // Deselecting - just remove and update counts
      this.selectedIssues.delete(issue.number);
      this.updateTokenCount();
    } else {
      // Selecting - add and fetch details
      this.selectedIssues.add(issue.number);
      this.updateTokenCount(); // Immediate update to show selection
      
      // Fetch issue details in background
      await this.fetchAndCacheIssue(issue.number);
    }
  }

  getSelectedIssues(): number[] {
    return Array.from(this.selectedIssues);
  }
  
  /**
   * Calculate token count for issue content
   */
  private calculateIssueTokens(issue: ApiIssue, comments: GitHubComment[]): number {
    let content = `Issue #${issue.number}: ${issue.title}\n`;
    
    if (issue.body) {
      content += `\n${issue.body}\n`;
    }
    
    if (comments.length > 0) {
      content += '\nComments:\n';
      for (const comment of comments) {
        content += `${comment.user.login}: ${comment.body}\n`;
      }
    }
    
    const tokens = encode(content);
    return tokens.length;
  }
  
  /**
   * Update total token count and emit event
   */
  private updateTokenCount(): void {
    this.totalIssueTokens = 0;
    
    // Sum tokens for all selected issues that are cached
    for (const issueNumber of this.selectedIssues) {
      const cached = this.issueCache.get(issueNumber);
      if (cached) {
        this.totalIssueTokens += cached.tokenCount;
      }
    }
    
    // Emit update event
    this._onDidChangeTokens.fire({
      totalTokens: this.totalIssueTokens,
      selectedCount: this.selectedIssues.size,
      isCounting: this.activeFetches.size > 0
    });
  }
  
  /**
   * Fetch issue details with caching
   */
  private async fetchAndCacheIssue(issueNumber: number): Promise<CachedIssueData | null> {
    // Check cache first
    const cached = this.issueCache.get(issueNumber);
    if (cached) {
      return cached;
    }
    
    // Check if already fetching
    if (this.activeFetches.has(issueNumber)) {
      return null;
    }
    
    if (!this.apiClient) {
      console.error('GitHub API client not initialized');
      return null;
    }
    
    try {
      this.activeFetches.add(issueNumber);
      this.updateTokenCount(); // Update to show "counting" state
      
      // Fetch issue details and comments in parallel
      const [issue, comments] = await Promise.all([
        this.apiClient.getIssue(issueNumber),
        this.apiClient.getIssueComments(issueNumber)
      ]);
      
      // Calculate tokens
      const tokenCount = this.calculateIssueTokens(issue, comments);
      
      // Cache the data
      const data: CachedIssueData = {
        issue,
        comments,
        tokenCount,
        fetchedAt: new Date()
      };
      
      this.issueCache.set(issueNumber, data);
      
      return data;
      
    } catch (error) {
      console.error(`Failed to fetch issue #${issueNumber}:`, error);
      // Still return null but don't break the flow
      return null;
    } finally {
      this.activeFetches.delete(issueNumber);
      this.updateTokenCount(); // Update with final count
    }
  }
  
  /**
   * Get the full issue details for selected issues (from cache)
   */
  async getSelectedIssueDetails(): Promise<Map<number, { issue: ApiIssue; comments: any[] }>> {
    const details = new Map<number, { issue: ApiIssue; comments: any[] }>();
    
    // Get from cache (already fetched during selection)
    for (const issueNumber of this.selectedIssues) {
      const cached = this.issueCache.get(issueNumber);
      if (cached) {
        details.set(issueNumber, {
          issue: cached.issue,
          comments: cached.comments
        });
      }
    }
    
    return details;
  }
  
  /**
   * Get current token status for initial state
   */
  getCurrentTokenStatus(): IssueTokenUpdate {
    return {
      totalTokens: this.totalIssueTokens,
      selectedCount: this.selectedIssues.size,
      isCounting: this.activeFetches.size > 0
    };
  }
}