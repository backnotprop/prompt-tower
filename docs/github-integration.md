# Prompt Tower: GitHub Issues Integration

## What This Does

GitHub Issues integration lets you include relevant issues alongside your code when creating context for AI coding assistants. Instead of manually copying issue descriptions into chat, select the issues you're working on and they automatically become part of your generated context.

This is particularly useful when:

- Working on bug fixes where the issue contains reproduction steps or user feedback
- Implementing features where the issue has detailed requirements or design decisions
- Getting AI help with code reviews where issues provide background context
- Debugging problems where similar issues contain relevant discussion

## How to Use It

### Basic Usage

1. **Open the GitHub Issues panel** in your Prompt Tower sidebar (appears automatically for GitHub repositories)
2. **Click to expand** the issues list - this loads your repository's open issues
3. **Select relevant issues** using the checkboxes next to each issue
4. **Generate context** as usual - selected issues will be included before your file selections

The integration detects your repository automatically from your git remote URL. No configuration needed for public repositories.

### Generated Context Format

Selected issues are formatted as structured blocks in your context:

```xml
<github_issue number="123" state="open">
  <title>Add dark mode toggle to settings page</title>
  <body>
    Users have requested the ability to switch between light and dark themes...

    Acceptance criteria:
    - Toggle switch in settings
    - Persists user preference
    - Affects all UI components
  </body>
  <comments>
    <!-- All issue comments included -->
  </comments>
</github_issue>
```

This gives AI assistants complete context about what you're building and why.

## Authentication

### When You Need It

- **Private repositories**: Authentication required to access issues
- **Heavy usage**: Rate limits kick in after ~3 context generations per hour without auth
- **Team repositories**: Some organizations require authentication for any API access

Get your PAT from the GitHub Settings, read here: [Docs for PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic)

You can see your tokens in GitHub Settings, under Developer settings -> Personal access tokens.
[Settings](https://github.com/settings/tokens)

### Setting Up Authentication

1. **Run the command**: `Prompt Tower: Add GitHub Token` from VS Code's Command Palette (Cmd/Ctrl+Shift+P)
2. **Generate a token**: You'll need a GitHub Personal Access Token with `repo` scope
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create a new token with `repo` permission
3. **Enter your token**: Paste it into the secure input field (tokens are stored locally and never shared)

Once authenticated, you get 5,000 API requests per hour instead of 60.

## Current Limitations

**Filtering**: No built-in filtering by label, assignee, or milestone yet. The extension loads recent open issues by default.

**Pagination**: The extension shows the 100 most recent open issues by default.

Future work can address these limitations.
