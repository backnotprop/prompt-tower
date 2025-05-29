# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands
- `npm run compile` - Compile TypeScript and lint code
- `npm run watch` - Start development watch mode (builds + type checking)
- `npm run package` - Create production build for VS Code extension
- `npm run lint` - Run ESLint on source files
- `npm run check-types` - Type check without emitting files
- `npm run test` - Run VS Code extension tests
- `npm run pretest` - Compile, build, and lint before running tests

### VS Code Extension Development
- Use `F5` in VS Code to launch Extension Development Host for testing
- Extension entry point: `./dist/extension.js` (compiled from `src/extension.ts`)
- Use `npm run watch` during development for automatic rebuilds

## Architecture Overview

This is a **VS Code Extension** that provides context management for LLM coding agents. The extension allows users to select files/folders and generate formatted context for copying to LLM chats.

### Core Components

**Extension Entry (`src/extension.ts`)**
- Main activation point and webview panel management
- Handles communication between tree view and webview UI
- Manages webview content generation and state synchronization

**Tree Data Provider (`src/providers/PromptTowerProvider.ts`)**
- Implements VS Code TreeDataProvider interface for file tree display
- Handles file selection state, token counting, and ignore pattern processing
- Core business logic for context generation and clipboard operations
- Uses `ignore` library for .gitignore/.towerignore pattern matching
- Integrates with `gpt-tokenizer` for real-time token counting

**Command Registration (`src/commands.ts`)**
- Registers all VS Code commands and event handlers
- Links tree view checkbox changes to provider state updates

**Models (`src/models/`)**
- `FileItem.ts` - Tree view item representation with checkbox state
- `EventEmitter.ts` - Custom event emitters for token count updates

**Utilities (`src/utils/`)**
- `fileTree.ts` - File tree structure generation for context output
- `alwaysIgnore.ts` - Default ignore patterns for common files

### Key Features Architecture

**File Selection & Filtering**
- Respects `.gitignore`, `.towerignore`, and manual ignore patterns
- Real-time file system watching for ignore file changes
- Checkbox-based selection with parent/child state management

**Context Generation**
- Template-based output formatting (XML, Markdown, etc.)
- Configurable file block templates and wrapper formats
- Support for project tree inclusion in multiple formats
- Prefix/suffix text support for prompt customization

**Token Counting**
- Debounced, asynchronous token counting using gpt-tokenizer
- Cancellation support for outdated calculations
- Real-time UI updates during counting operations

**Webview Integration**
- HTML/CSS/JS webview for advanced UI controls
- Bidirectional communication between extension and webview
- State persistence and preview invalidation logic

### Configuration

The extension is highly configurable through VS Code settings (`promptTower.*`):
- Output format templates and separators
- File size warning thresholds  
- Ignore patterns and .gitignore integration
- Project tree display options

### Development Notes

- Uses esbuild for compilation (see `esbuild.js`)
- TypeScript with strict mode enabled
- ESLint configuration in `eslint.config.mjs`
- Extension manifest in `package.json` with comprehensive VS Code contribution points