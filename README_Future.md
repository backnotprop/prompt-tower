# Prompt Tower: Context Management for LLM Coding

Prompt Tower helps you overcome the context limitations of Large Language Models (LLMs) and coding agents. It provides tools within your IDE to precisely select, structure, and template the codebase information needed for effective AI interaction. Build complex, accurate prompts locally before sending them to your chosen LLM.

Supports IDEs compatible with Open VSX: **VS Code**, **Cursor**, **Windsurf**, **Google IDX**.

_(Access Prompt Tower via its icon in the Activity Bar – it opens in a dedicated UI tab.)_

## Why Prompt Tower? Master Your Context

LLMs and coding agents are powerful, but their effectiveness hinges on the quality and structure of the context provided. Manually assembling this from a complex codebase is inefficient and error-prone. Prompt Tower gives you control:

- **🎯 Precision Context Management:** Go beyond simple file inclusion. Select exactly what's needed, visualize the structure, and manage token counts effectively.
- **🏗️ Structured Prompt Assembly:** Use templates and dynamic elements to build reusable, maintainable prompts that give AI the architectural understanding it needs.
- **⚙️ Overcome Agent Limitations:** By carefully curating the context yourself, you can guide AI tools more effectively than relying on their often imperfect context gathering.
- **🔒 Local & Integrated:** Build your prompt securely within your IDE workflow.

## Core Features

- **🗂️ Flexible Context Selection:**

  - **FileTree View:** Checkboxes for rapid selection of multiple files and entire folders in a dedicated tree. Respects `.gitignore` (toggleable: `promptTower.useGitIgnore`) and `.towerignore`.
  - **Quick Add Actions:** Right-click files/selections in the editor or explorer to add them instantly.

- **📝 Powerful Context Templating:**

  - Define reusable prompt structures with static instructions and dynamic placeholders.
  - Manage multiple templates (e.g., for debugging, refactoring, documentation).
  - **Placeholders:** Use `%path/to/file.ext` for live file content and `%snippetName` for predefined text blocks (managed in settings). This is central to dynamic prompt generation.

- **🗼 Visualize & Organize Context (The Tower View):**

  - See selected files, directories, and text snippets as distinct blocks.
  - Monitor **token estimates per block** and the total count.
  - Expand directories to understand included structure.
  - Preview file content directly.
  - **Reorder blocks** via drag-and-drop to structure the final prompt logically.

- **🌳 Include Directory Structures:**

  - Add formatted text representations of your project hierarchy (full project, selected files only, etc.) to provide vital architectural context.

- **✂️ Code Formatting & Preparation:**

  - Option to **remove comments** automatically from included code.
  - Configurable wrappers (e.g., XML tags, Markdown fences) around context blocks – defaults to `<file path="...">...</file>`.

- **📄 Summarization for Large Files:**

  - Optionally use `.summary` files instead of full file content to conserve tokens while providing high-level context.

- **📊 Live Preview:**

  - A real-time view of the final assembled prompt based on your selections and template.

- **⚙️ Customizable:**
  - Tailor behavior via IDE settings (ignores, snippets, wrappers, summarization rules, etc.).
