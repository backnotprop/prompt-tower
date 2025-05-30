/**
 * Token counting update payload
 */
export interface TokenUpdatePayload {
  /** Total token count */
  count: number;
  
  /** Whether token counting is currently in progress */
  isCounting: boolean;
  
  /** File token count (excluding GitHub issues) */
  fileTokens?: number;
  
  /** GitHub issues token count */
  issueTokens?: number;
  
  /** Error message if token counting failed */
  error?: string;
}

/**
 * File selection change event
 */
export interface FileSelectionChangeEvent {
  /** The file node that changed */
  node: import('./FileNode').FileNode;
  
  /** New checked state */
  isChecked: boolean;
  
  /** Whether the change affects children */
  propagateToChildren: boolean;
}

/**
 * Workspace change event
 */
export interface WorkspaceChangeEvent {
  /** Type of change */
  type: 'added' | 'removed' | 'modified';
  
  /** The workspace that changed */
  workspace: import('./Workspace').Workspace;
}

/**
 * Context generation event
 */
export interface ContextGenerationEvent {
  /** Generated context string */
  context: string;
  
  /** Number of files included */
  fileCount: number;
  
  /** Token count of generated context */
  tokenCount: number;
  
  /** Whether context was copied to clipboard */
  copiedToClipboard: boolean;
}