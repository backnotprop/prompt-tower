import * as vscode from 'vscode';
import { execSync } from 'child_process';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  isGitHub: boolean;
  defaultBranch?: string;
}

export interface GitHubAuthStatus {
  isAuthenticated: boolean;
  authMethod?: 'gh-cli' | 'pat' | 'none';
  username?: string;
}

export class GitHubConfigManager {
  private static readonly TOKEN_KEY = 'promptTower.github.token';
  private static readonly REPO_OVERRIDE_KEY = 'promptTower.github.repoOverride';

  /**
   * Auto-detect repository information from git remote
   */
  static async detectRepoInfo(workspaceRoot?: string): Promise<GitHubRepoInfo | null> {
    try {
      const gitOptions = workspaceRoot 
        ? { encoding: 'utf8' as const, cwd: workspaceRoot }
        : { encoding: 'utf8' as const };
        
      const remoteUrl = execSync('git config --get remote.origin.url', gitOptions).trim();
      
      // Parse GitHub URL patterns
      // SSH: git@github.com:owner/repo.git
      // HTTPS: https://github.com/owner/repo.git
      const githubPattern = /(?:git@github\.com:|https:\/\/github\.com\/)([^/]+)\/(.+?)(?:\.git)?$/;
      const match = remoteUrl.match(githubPattern);
      
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          isGitHub: true,
          defaultBranch: this.getDefaultBranch(workspaceRoot)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to detect repo info:', error);
      return null;
    }
  }

  /**
   * Check authentication status - tries gh CLI first, then PAT
   */
  static async checkAuthStatus(context: vscode.ExtensionContext): Promise<GitHubAuthStatus> {
    // First, try gh CLI
    try {
      const ghUser = execSync('gh auth status --show-token 2>&1', { encoding: 'utf8' });
      if (ghUser.includes('Logged in')) {
        return {
          isAuthenticated: true,
          authMethod: 'gh-cli',
          username: this.extractGhUsername(ghUser)
        };
      }
    } catch (error) {
      // gh CLI not authenticated, continue to check PAT
    }

    // Check for stored PAT
    const storedToken = await context.secrets.get(this.TOKEN_KEY);
    if (storedToken) {
      // TODO: Validate token with GitHub API
      return {
        isAuthenticated: true,
        authMethod: 'pat'
      };
    }

    return {
      isAuthenticated: false,
      authMethod: 'none'
    };
  }

  /**
   * Store GitHub PAT securely
   */
  static async storePAT(context: vscode.ExtensionContext, token: string): Promise<void> {
    await context.secrets.store(this.TOKEN_KEY, token);
  }

  /**
   * Get stored PAT
   */
  static async getPAT(context: vscode.ExtensionContext): Promise<string | undefined> {
    return await context.secrets.get(this.TOKEN_KEY);
  }

  /**
   * Override auto-detected repo (for edge cases)
   */
  static async setRepoOverride(context: vscode.ExtensionContext, owner: string, repo: string): Promise<void> {
    await context.workspaceState.update(this.REPO_OVERRIDE_KEY, { owner, repo });
  }

  private static getDefaultBranch(workspaceRoot?: string): string {
    try {
      const gitOptions = workspaceRoot 
        ? { encoding: 'utf8' as const, cwd: workspaceRoot }
        : { encoding: 'utf8' as const };
        
      return execSync('git symbolic-ref refs/remotes/origin/HEAD | sed "s@^refs/remotes/origin/@@"', 
        gitOptions).trim();
    } catch {
      return 'main'; // fallback
    }
  }

  private static extractGhUsername(ghOutput: string): string | undefined {
    const match = ghOutput.match(/Logged in to github\.com as ([^\s]+)/);
    return match ? match[1] : undefined;
  }
}