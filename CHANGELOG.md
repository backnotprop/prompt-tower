# Change Log

## [Version 1.2.0] - Unreleased

### Fixed
- **Multi-workspace support:** Files from all workspace folders now appear in the tree view, not just the first folder. Thanks to @majdalsado and @jskulski for reporting (#28)

### Changed
- **Complete architecture refactor:** Replaced 1,448-line monolithic provider with clean service-oriented architecture
- **Improved maintainability:** Each service now has single responsibility with proper separation of concerns
- **Better performance:** Services can be optimized independently, token counting has proper cancellation

### Added
- **DEVELOPMENT.md:** Concise architecture documentation for contributors
- **Per-workspace ignore handling:** Each workspace folder has its own .gitignore/.towerignore processing
- **Relative path support:** Properly handles workspace configurations with relative paths like `"../other-project"`

## [Version 1.1.0] - 2025-05-27

### Added
- **GitHub Issues Integration:** Select and include GitHub issues directly in your context, with automatic token counting
- **Issue Comments:** Full issue threads including all comments are included in generated context
- **GitHub Authentication:** Support for GitHub PAT tokens for private repositories and higher rate limits
- **Auto-detection:** Automatically detects GitHub repository from git remote URL

## [Version 1.0.0] - 2025-03-30

This release focuses on significantly enhancing the context-building workflow by refining the Prompt Tower functionality based on user feedback.

### Added

- **Native File Tree Integration:** Select files and folders directly from the VS Code explorer to build context.
- **Flexible Template Syntax:** Customizable prompt and context templating, now defaulting to an XML-style structure (e.g., `<context>...</context>`).
- **Directory Tree Injection:** Option to automatically include a representation of selected directory structures within the context. This is customizable:
  - Full tree (files and directories)
  - Full tree (directories only)
  - Selected items only
- **Enhanced Ignore Capabilities:** More robust file/folder ignoring, including support for a project-level `.towerignore` file (similar to `.gitignore`).

### Changed

- **Prompt Tower Re-architecture:** Overhauled the core functionality to align more closely with tools like CodeIngest, emphasizing flexibility and integration with the native VS Code UI. The ability to add a prompt above or below the generated context remains.

### Removed

- **Visual Tower Interface:** The graphical representation of the "tower" has been removed in favor of the new file-tree-based workflow.
- **Direct Selection-to-Tower:** The command to send selected text directly to the visual tower has been removed.
  - _Note: If the Visual Tower or direct selection sending were valuable parts of your workflow, please provide feedback. They could potentially be re-introduced in future updates._

### Acknowledgements

- Special thanks to **@arthurwolf** for the detailed feedback that heavily influenced this update.

---

_Documentation for these new features is currently being prepared and will be released soon._
