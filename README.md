# Prompt Tower

<img src="https://github.com/backnotprop/prompt-tower/blob/main/extension-assets/image.png?raw=true" alt="Prompt Tower" width="180"/>

**Comprehensive context and prompt management for your Coding Agents and CodeLLMs**

Prompt Tower is a VS Code extension that is also compatible with Cursor, Windsurf, and Google IDX.

A dedicated interface to select files/folders, include directory trees, customize formatting, and to generate the exact context your coding agents need to be more effective while saving you tokens.

![Prompt Tower Demo](https://github.com/backnotprop/prompt-tower/blob/main/extension-assets/prompt-tower-v1.0.0.gif?raw=true)

---

## Key Features ✨

- ✅ **Effortless File Selection:** Checkbox tree view for easy file/folder selection (Launch from the **Activity Bar**).
- 🚀 **Instant Context Generation:** Build & copy complex context to clipboard in one click.
- 🔧 **Highly Configurable Output:** Customize context format (XML, MD, etc.) with templates.
- 🌲 **Project Tree Context:** Optionally include a structured project overview in context (also configurable).
- 🔍 **Robust Filtering:** Respects `.gitignore`, `.towerignore`, and custom ignore rules to keep context lean.
- 📊 **Live Token Count:** Real-time token count estimate helps manage context size.
- 📝 **Dedicated UI Panel:** Manage prefix/suffix, preview, tokens & actions easily.
- 🔔 **File Size Warnings:** Get notified when selecting potentially oversized files.

---

## Core Concepts

- **File Tree View:** Located in the Activity Bar section. This is where you select files/folders using checkboxes. It respects ignore files (`.towerignore`, `.gitignore`, `promptTower.ignore`, config).
- **UI Panel:** Opens as a separate tab. This is your control center:
  - **Token Count:** Shows the live estimated token count for selected files.
  - **Prefix/Suffix:** Add text before or after the generated file context blocks.
  - **Actions:** Buttons to generate context, copy it, clear selections, etc.
  - **Preview:** Shows what the generated context will look like based on your selections and formatting settings. _Note: The preview becomes "invalidated" (orange border) if you change selections/prefix/suffix after generating it – click "Create Context" again to update._

---

## Configuration Deep Dive

Fine-tune Prompt Tower via VS Code Settings (UI or `settings.json`). Access via `File > Preferences > Settings` and search for "Prompt Tower".

### Ignoring Files (`.towerignore`, `promptTower.useGitignore`, `promptTower.ignore`)

Prompt Tower uses 3 ways to exclude files from LLM context.
<em>Exclusion is inclusive</em> - every rule found across the three sources is used for exclusion.

- `.gitignore` - **Recommended: True (the Default)** - you likely never want to pass any of this to an LLM.
- `.towerignore` - **Recommended: Per Project (You need to create this)** - for keeping reducing overall-project context.
- `promptTower.ignore` - **IDE Setting (Workspace or User)** - use as you see fit. The defaults are common lock files that typically aren't in .gitignore.

Control which files/folders are _excluded_ from the Prompt Tower tree view:

- **`.towerignore` File**:
  - Create a `.towerignore` file in your workspace root (same format as `.gitignore`). Patterns here are _also_ used for exclusion, alongside `.gitignore` and manual settings. This is useful for ignoring things specific to context generation but not general Git usage.
- **`promptTower.useGitignore`**: (Boolean, default: `true`)
  - If `true`, patterns from `.gitignore` in your workspace root are used for exclusion.
- **`promptTower.ignore`**: (Array of strings, default: `["package-lock.json", "yarn.lock", ...]`)
  - A manual list of file/folder names or simple patterns to _always_ ignore, in _addition_ to `.gitignore` / `.towerignore`.
  - Standard ignores like `.git`, `node_modules`, `.vscode`, `dist`, `out` are included by default unless overridden by complex configurations.

**Example (`settings.json`):**

```json
{
  "promptTower.useGitignore": true,
  "promptTower.ignore": [
    "package-lock.json", // Prompt Tower defaults to ignore lock files
    "yarn.lock",
    "poetry.lock",
    "Gemfile.lock"
    // The default also includes many common binary files (documents, images, videos, audio, etc.)
  ]
}
```

### Output Formatting (`promptTower.outputFormat`)

This is the core of customization. Control exactly how the selected files and project tree are formatted.

- **`blockTemplate`**: (String)

  - Defines the format for _each_ selected file's content.
  - **Placeholders:**
    - `{fileContent}`: The actual content of the file.
    - `{rawFilePath}`: The workspace-relative path (e.g., `/src/utils/helpers.ts`). _Ensures leading slash and uses forward slashes._
    - `{fileNameWithExtension}`: The file name including extension (e.g., `helpers.ts`).
    - `{fileName}`: File name without extension (e.g., `helpers`).
    - `{fileExtension}`: The file extension (e.g., `.ts`).
    - `{fullPath}`: The absolute path on your disk.
  - **Default (XML-like):**
    ```json
    "promptTower.outputFormat.blockTemplate": "<file name=\"{fileNameWithExtension}\" path=\"{rawFilePath}\">\n{fileContent}\n</file>"
    ```
  - **Example (Markdown):**
    ````json
    "promptTower.outputFormat.blockTemplate": "``` {fileExtension}\n# Path: {rawFilePath}\n\n{fileContent}\n```"
    ````

- **`blockSeparator`**: (String, default: `\n`)

  - The string inserted _between_ each formatted file block.

- **`projectTreeFormat`**: (Object)

  - Controls the optional project tree block.
  - `enabled`: (Boolean, default: `true`) Include the project tree block?
  - `type`: (String, default: `"fullFilesAndDirectories"`)
    - `"fullFilesAndDirectories"`: Show all non-ignored files and folders in the workspace.
    - `"fullDirectoriesOnly"`: Show all non-ignored directories in the workspace.
    - `"selectedFilesOnly"`: Only include the _selected_ files in the tree structure.
  - `showFileSize`: (Boolean, default: `true`) Display file sizes in the tree (ignored if `type` is `"fullDirectoriesOnly"`).
  - `template`: (String, default: `"<project_tree>\n{projectTree}\n</project_tree>\n"`) Wrapper for the generated tree. Use `{projectTree}` as the placeholder.

- **`wrapperFormat`**: (Object | null, default: Object)
  - Controls the overall wrapper around the _entire_ output (tree + file blocks). Set to `null` to disable wrapping entirely.
  - `template`: (String) The wrapper template.
  - **Placeholders:**
    - `{treeBlock}`: Where the formatted `projectTreeFormat.template` (if enabled) is inserted.
    - `{blocks}`: Where the combined, separated file blocks (using `blockTemplate`) are inserted.
    - `{timestamp}`: ISO timestamp of generation (replaces `2025-03-30T23:18:01.031Z` placeholder in default).
    - `{fileCount}`: Number of files included (replaces `6` placeholder in default).
    - `{workspaceRoot}`: Absolute path to the workspace root (replaces `/Users/ramos/prompt-tower` placeholder in default).
  - **Default (XML-like):**
    ```json
    "promptTower.outputFormat.wrapperFormat": {
      "template": "<context>\n{treeBlock}<project_files>\n{blocks}\n</project_files>\n</context>"
    }
    ```

### Other Settings

- **`promptTower.maxFileSizeWarningKB`**: (Number, default: `500`) Show a warning prompt if a selected file exceeds this size in KB.

---

## Why Prompt Tower?

Building effective prompts for code-focused LLMs often requires providing substantial context – multiple files, directory structures, etc. Doing this manually is:

1.  **Tedious:** Copy-pasting file contents one by one is slow.
2.  **Error-Prone:** Easy to miss files, format incorrectly, or paste outdated code.
3.  **Inefficient:** Hard to quickly iterate on different context combinations.

Prompt Tower streamlines this entire process, letting you focus on the _prompt_ itself, not the plumbing of context assembly.

---

## Getting Started

1.  **Install:** Search for "Prompt Tower" in the VS Code Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`) and click Install.
2.  **Open:** Click the Prompt Tower icon in the **Activity Bar** (it looks like a tower of blocks).
3.  **Select:** Use the checkboxes in the "Prompt Tower" file tree view to select the files and folders you want to include as context.
4.  **Configure (Optional):** Use the "Prompt Tower UI" panel to add a prefix or suffix to your prompt.
5.  **Generate:**
    - Click **"Create Context, Copy to Clipboard"** in the UI Panel (or use the `Copy Context to Clipboard` command/icon) to generate the context and copy it.
    - Click **"Create Context"** to generate and view it in the preview area without copying.
6.  **Paste:** Paste the generated context into your LLM chat/interface.

---

## Available Commands (Command Palette: `Ctrl+Shift+P` or `Cmd+Shift+P`)

- `Prompt Tower: Show Prompt Tower UI`: Opens the main UI panel.
- `Prompt Tower: Copy Context to Clipboard`: Generates context from selected files and copies it.
- `Prompt Tower: Refresh File List`: Reloads the file tree view.
- `Prompt Tower: Toggle All Files`: Checks/unchecks all files in the tree view.
- `Prompt Tower: Clear All Selections`: Unchecks all files.
- `Prompt Tower: Reset all`: Clears selections _and_ resets prefix/suffix in the UI panel.

---

## Contributing & Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/backnotprop/prompt-tower/issues) on the GitHub repository.

Contributions are welcome!

## License

This extension is licensed under the **AGPL-3.0 License**. Please review the license before contributing or using the code in other projects. See the [LICENSE](LICENSE) file for details. (Note: AGPL has specific implications regarding distribution and modification).

---

Made by [Michael Ramos](https://github.com/backnotprop) ([@backnotprop](https://github.com/backnotprop)).
