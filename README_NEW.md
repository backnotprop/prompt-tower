# Prompt Tower

<div align="center">
  <img src="https://github.com/backnotprop/prompt-tower/blob/main/assets/image-tny.png?raw=true" alt="Prompt Tower" width="180"/>
</div>
<hr>

**Prompt Tower is the fastest way to build complete prompts for AI coding assistants.** It's a utility that packages your codebase context—files, directory trees, GitHub issues—into a single, perfectly formatted prompt. Select what you need, see token counts, copy to clipboard. Everything baked in.

Perfect for:

- 🌌 Gemini's 1M token context window
- 🧊 Cursor's agent (evolved from composer)
- 🖥️ Claude Code CLI sessions
- 🤖 Any LLM that needs to understand your code

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=backnotprop.prompt-tower) • Works in VS Code, Cursor, Windsurf, Google IDX

---

## The Vibe Coding Revolution Needs Better Context

Modern coding with AI agents isn't about writing every line—it's about orchestrating. You describe what you want, the AI builds it. But here's the catch: **AI can only work with what it knows.**

Without proper context, you get:

- Generic solutions that don't fit your architecture
- Suggestions that ignore your existing patterns
- Repeated back-and-forth explaining your codebase

Prompt Tower fixes this. One click, perfect context, every time.

![Prompt Tower Demo](https://github.com/backnotprop/prompt-tower/blob/main/assets/prompt-tower-v1.0.0.gif?raw=true)

---

## Core Features

### 📁 Visual File Selection

Click the tower icon in your Activity Bar. Check boxes next to files and folders. **Live token counting** shows exactly how much context you're building. No command line, no manual paths.

### 🌳 Automatic Directory Trees

Every prompt includes your project structure. AI understands your architecture instantly:

```
src/
├── services/
│   ├── TokenCountingService.ts (2.8KB)
│   └── ContextGenerationService.ts (4.1KB)
├── providers/
│   └── MultiRootTreeProvider.ts (12.3KB)
└── extension.ts (5.7KB)
```

### 🐙 GitHub Issues as Context

Import issues and comments directly. Your AI understands not just the code, but the problems you're solving.

### 📊 Token Intelligence

Real-time token counting for every file. See total context size. Never hit limits unexpectedly. Perfect for optimizing Gemini's massive context window.

### 🎨 Smart Output Format

Clean, structured context that AI loves:

```xml
<context>
<project_tree>
src/
├── api/
│   └── GitHubApiClient.ts (5.2KB)
└── services/
    └── TokenCountingService.ts (2.8KB)
</project_tree>
<project_files>
<file path="/src/api/GitHubApiClient.ts">
export class GitHubApiClient {
  // Your actual code here
}
</file>
</project_files>
</context>
```

### 🎯 .towerignore - Control Your Context

The most powerful feature. Create a `.towerignore` file to keep your prompts lean and relevant:

```gitignore
# Exclude test data
tests/fixtures/
*.test.js

# Skip generated files
dist/
*.min.js

# Large files
*.csv
data/
```

Works like `.gitignore`, stacks with it. This is how you manage massive codebases effectively.

### ⚡ Instant Copy

One button. Full context in your clipboard. Paste into Gemini, Claude Code, Cursor, or any AI chat.

---

## Real Workflows

### Massive Context with Gemini

Select entire modules, test files, documentation. The directory tree shows Gemini your architecture. Add a prefix with your requirements. With 1M tokens, include everything relevant. One complete prompt, perfect understanding.

### Cursor Agent Sessions

The new Cursor agent needs comprehensive context. Select implementation + tests + types. Paste the complete prompt. Watch it refactor with full codebase awareness.

### Claude Code TUI Sessions

Copy your Prompt Tower context, paste it directly in the Claude Code chat. Claude instantly has your entire codebase context—files, structure, issues. Ask your question. Get accurate, context-aware solutions immediately.

---

## Quick Start

1. **Install**: Search "Prompt Tower" in Extensions
2. **Click**: Tower icon in Activity Bar
3. **Select**: Check files you need
4. **Copy**: "Copy Context to Clipboard"
5. **Paste**: Into any AI assistant

---

## Configuration

- **Output format**: Customizable templates (defaults work great - XML-wrapped files with directory tree)
- **Global ignores**: `promptTower.ignore` in VS Code settings for patterns across all projects
- **Token warnings**: Alerts when selecting large files

---

## Why This Exists

I built Prompt Tower because I was tired of:

- Copy-pasting files one by one
- Losing track of what context I'd provided
- AI suggesting patterns that didn't match my codebase
- Token limit surprises mid-conversation

This tool is for developers who've embraced AI-assisted coding but need better control over context. It's the missing piece between your codebase and your AI assistant.

---

## Open Source

[MIT License](LICENSE) • [GitHub](https://github.com/backnotprop/prompt-tower) • [Issues](https://github.com/backnotprop/prompt-tower/issues)

Built by [@backnotprop](https://github.com/backnotprop) and contributors who believe AI coding should be effortless.
