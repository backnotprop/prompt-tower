# Development Guide

## Architecture Overview

Clean service-oriented architecture replacing monolithic god object. Each service has single responsibility.

## Source Directory Structure

### `/api`
- **GitHubApiClient.ts** - GitHub REST API wrapper for issues/comments fetching

### `/models`
- **FileNode.ts** - Multi-workspace tree node model with parent/child relationships
- **Workspace.ts** - VS Code workspace representation, config interfaces
- **Events.ts** - Event payload types for token updates, file selection changes
- **EventEmitter.ts** - Token update event emitter (legacy, use VS Code EventEmitter)

### `/providers`
- **MultiRootTreeProvider.ts** - Main tree data provider supporting multi-folder workspaces
- **GitHubIssuesProvider.ts** - GitHub issues tree with token counting, caching

### `/services`
- **WorkspaceManager.ts** - Discovers/manages VS Code workspace folders, handles relative paths
- **FileDiscoveryService.ts** - File discovery per workspace using RelativePattern
- **IgnorePatternService.ts** - Per-workspace .gitignore/.towerignore handling
- **TokenCountingService.ts** - Async token counting with cancellation support
- **ContextGenerationService.ts** - Template-based context generation, includes GitHub issues

### `/utils`
- **fileTree.ts** - ASCII tree generation for project structure
- **alwaysIgnore.ts** - Built-in ignore patterns array
- **githubConfig.ts** - GitHub auth token management, repo detection

### Root Files
- **extension.ts** - Extension entry point, service initialization, command registration

### `/test`
- **extension.test.ts** - Basic test setup (needs expansion)

## Key Architecture Changes

1. **Multi-workspace support**: Each workspace folder is a tree root
2. **Service injection**: Dependencies passed to constructors, not created internally
3. **Event-driven**: Token updates via EventEmitter, file changes via VS Code events
4. **Clean separation**: Business logic in services, UI in providers, activation in extension

## Development Notes

- TypeScript strict mode enabled
- Use `npm run watch` for development
- Press F5 to launch Extension Development Host
- All services dispose via context.subscriptions