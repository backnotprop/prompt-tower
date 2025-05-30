/**
 * Represents a workspace folder in a multi-root VS Code workspace
 */
export interface Workspace {
  /** Unique identifier for the workspace */
  id: string;
  
  /** Display name for the workspace (from VS Code or folder name) */
  name: string;
  
  /** Absolute file system path to the workspace root */
  rootPath: string;
  
  /** VS Code workspace folder URI */
  uri: string;
  
  /** Index in the workspace folders array */
  index: number;
}

/**
 * Represents ignore patterns for a workspace
 */
export interface IgnorePatterns {
  /** Patterns from .gitignore file */
  gitignore: string[];
  
  /** Patterns from .towerignore file */
  towerignore: string[];
  
  /** Manual patterns from VS Code configuration */
  manual: string[];
  
  /** Always ignored patterns (built-in) */
  builtin: string[];
}

/**
 * Configuration for context generation
 */
export interface ContextConfig {
  /** Template for individual file blocks */
  blockTemplate: string;
  
  /** Separator between file blocks */
  blockSeparator: string;
  
  /** Whether to trim leading/trailing blank lines */
  blockTrimLines: boolean;
  
  /** Overall wrapper template */
  wrapperTemplate: string | null;
  
  /** Project tree configuration */
  projectTree: {
    enabled: boolean;
    type: 'fullFilesAndDirectories' | 'fullDirectoriesOnly' | 'selectedFilesOnly' | 'none';
    showFileSize: boolean;
    template: string;
  };
  
  /** User-defined prefix and suffix */
  promptPrefix: string;
  promptSuffix: string;
  
  /** File size warning threshold in KB */
  maxFileSizeWarningKB: number;
}