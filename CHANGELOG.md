# Change Log

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
