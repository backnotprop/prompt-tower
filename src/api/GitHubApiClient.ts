import * as vscode from 'vscode';
import { GitHubConfigManager } from '../utils/githubConfig';

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  created_at: string;
  updated_at: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
  user: {
    login: string;
  };
  comments: number;
  html_url: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: {
    login: string;
  };
}

interface GitHubApiError extends Error {
  status?: number;
  response?: any;
}

export class GitHubApiClient {
  private readonly baseUrl = 'https://api.github.com';
  private token?: string;
  
  constructor(
    private context: vscode.ExtensionContext,
    private owner: string,
    private repo: string
  ) {}
  
  /**
   * Initialize the client by checking for authentication
   */
  async initialize(): Promise<void> {
    this.token = await GitHubConfigManager.getPAT(this.context);
  }
  
  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PromptTower-VSCode',
      ...(options.headers as Record<string, string> || {}),
    };
    
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // Update rate limit info if available
      if (response.headers) {
        this.updateRateLimitInfo(response.headers);
      }
      
      if (!response.ok) {
        const error = new Error() as GitHubApiError;
        error.status = response.status;
        
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            error.message = 'GitHub API rate limit exceeded';
          } else {
            error.message = 'Access forbidden';
          }
        } else if (response.status === 404) {
          error.message = 'Repository not found';
        } else if (response.status === 401) {
          error.message = 'Authentication required';
        } else {
          error.message = `GitHub API error: ${response.status}`;
        }
        
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error; // Re-throw our custom errors
      }
      
      // Network errors
      console.error('GitHub API request failed:', error);
      throw new Error('Failed to connect to GitHub API');
    }
  }
  
  /**
   * List issues for the repository
   */
  async listIssues(
    state: 'open' | 'closed' | 'all' = 'open',
    perPage: number = 100
  ): Promise<GitHubIssue[]> {
    const endpoint = `/repos/${this.owner}/${this.repo}/issues`;
    const params = new URLSearchParams({
      state,
      per_page: perPage.toString(),
      sort: 'created',
      direction: 'desc',
    });
    
    return this.request<GitHubIssue[]>(`${endpoint}?${params}`);
  }
  
  /**
   * Get a single issue with full details
   */
  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const endpoint = `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`;
    return this.request<GitHubIssue>(endpoint);
  }
  
  /**
   * Get comments for an issue
   */
  async getIssueComments(issueNumber: number): Promise<GitHubComment[]> {
    const endpoint = `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`;
    return this.request<GitHubComment[]>(endpoint);
  }
  
  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(headers: Headers | Record<string, string>): void {
    // TODO: Implement if we decide to show rate limit info
    // Could emit events or update a status bar item
  }
  
  /**
   * Check if the current repo is accessible
   */
  async checkRepoAccess(): Promise<boolean> {
    try {
      const endpoint = `/repos/${this.owner}/${this.repo}`;
      await this.request(endpoint);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Set or update the authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }
}