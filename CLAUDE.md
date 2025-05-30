# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run watch      # Development mode with auto-rebuild
npm run compile    # Build extension (type check + lint + build)
npm run lint       # Run ESLint
npm run test       # Run tests
npm run package    # Production build
```

To develop: Run `npm run watch` and press F5 to launch Extension Development Host.

## Architecture Overview

This is a **VS Code Extension** that provides context management for LLM coding agents. Users can select files/folders, import GitHub issues, and generate formatted context (XML/Markdown) for AI assistants. Compatible with VS Code, Cursor, Windsurf, and Google IDX.

### Service-Oriented Architecture

The codebase follows clean service architecture with dependency injection:

**Core Services (`src/services/`)**
- `WorkspaceManager.ts` - Manages VS Code workspace folders, handles relative paths
- `FileDiscoveryService.ts` - File discovery per workspace using RelativePattern
- `IgnorePatternService.ts` - Per-workspace .gitignore/.towerignore handling
- `TokenCountingService.ts` - Async token counting with cancellation support
- `ContextGenerationService.ts` - Template-based context generation, includes GitHub issues

**Data Providers (`src/providers/`)**
- `MultiRootTreeProvider.ts` - Main tree provider supporting multi-folder workspaces
- `GitHubIssuesProvider.ts` - GitHub issues tree with token counting and caching

**Models (`src/models/`)**
- `FileNode.ts` - Multi-workspace tree node with parent/child relationships
- `Workspace.ts` - VS Code workspace representation and config interfaces
- `Events.ts` - Event payload types for token updates and file selection
- `EventEmitter.ts` - Token update event emitter

**Extension Entry (`src/extension.ts`)**
- Service initialization with dependency injection
- Command registration and webview panel management
- Handles communication between tree view and webview UI

### Key Implementation Details

**Multi-Workspace Support**
- Each workspace folder is a tree root
- Services handle per-workspace configurations
- Relative path resolution per workspace

**Context Generation Flow**
1. User selects files via checkbox tree UI
2. `MultiRootTreeProvider` tracks selection state
3. `TokenCountingService` counts tokens asynchronously
4. `ContextGenerationService` applies templates to generate output
5. Output copied to clipboard or shown in webview

**Template System**
- Configurable via `promptTower.outputFormat` setting
- Supports placeholders: `{fileContent}`, `{filePath}`, `{projectTree}`, etc.
- Three-level structure: wrapper → blocks → individual files

**File Filtering**
- Three-tier system: `.gitignore` → `.towerignore` → manual patterns
- Uses `ignore` library for pattern matching
- Real-time file watching for ignore file changes

### Testing & Validation

When making changes:
1. Run `npm run validate` to check types and lint
2. Test multi-workspace scenarios (open folder with multiple roots)
3. Verify token counting updates in real-time
4. Check webview communication for UI features

### Common Tasks

**Adding a new command:**
1. Define in `package.json` contributes.commands
2. Register in `extension.ts` activate function
3. Implement handler using appropriate services

**Modifying context output:**
1. Update templates in `ContextGenerationService.ts`
2. Add new placeholders if needed
3. Update default config in `package.json`

**Adding file filtering:**
1. Modify `IgnorePatternService.ts` for pattern logic
2. Update `FileDiscoveryService.ts` for discovery rules
3. Add UI controls in tree provider if needed
