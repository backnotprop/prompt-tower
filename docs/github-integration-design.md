# GitHub Integration Design

## Core Principles
1. **Zero-config for public repos** - Should work immediately without setup
2. **Progressive enhancement** - Add auth only when needed
3. **UI-first configuration** - Minimize JSON config, maximize UI controls
4. **Reusable pattern** - Set precedent for Linear, Jira, etc.

## User Flow

### 1. First Experience (No Auth)
```
User opens Prompt Tower → Sees GitHub Issues in tree view
├─ Shows public issues if public repo (auto-detected)
├─ Shows "Authentication Required" if private repo
└─ Shows "Configure Repository" if not in git repo
```

### 2. Authentication Flow
```
If auth needed → Click "Configure GitHub Access" in webview
├─ Option 1: "Use GitHub CLI" (if `gh` is installed)
├─ Option 2: "Use Personal Access Token"
│   ├─ Link to create token with correct scopes
│   ├─ Secure input field
│   └─ Validate on save
└─ Option 3: "Skip for now" (public repos only)
```

### 3. Issue Selection UX
```
GitHub Issues (tree view)
├─ [✓] #123: Add dark mode support
├─ [ ] #124: Fix memory leak
└─ [ ] #125: Improve performance

Selected issues → Include in context generation
```

## Webview Panel Enhancement

Add tabs to the main panel:
```
┌──────────────────────────────────────────┐
│ [Context] [Integrations] [Settings]      │
├──────────────────────────────────────────┤
│ Integrations Tab Content:                │
│                                          │
│ GitHub Issues                            │
│ • Repository: owner/repo ✓               │
│ • Authentication: Connected as @user     │
│ • [Import Issues] [Settings]             │
│                                          │
│ ─────────────────────────────            │
│                                          │
│ Linear (Coming Soon)                     │
│ • Connect your Linear workspace          │
│                                          │
│ ─────────────────────────────            │
│                                          │
│ Custom Sources                           │
│ • Import from URLs, APIs, etc.           │
└──────────────────────────────────────────┘
```

## Configuration Storage

```typescript
// Workspace-level (per project)
interface WorkspaceConfig {
  github?: {
    repoOverride?: { owner: string; repo: string };
    selectedIssues?: number[];
    issueTemplate?: string;
  };
  integrations?: {
    [key: string]: any; // Extensible for future
  };
}

// User-level (secure secrets)
interface SecureConfig {
  githubToken?: string;
  linearApiKey?: string;
  // Future: other service tokens
}
```

## Issue Context Template

Default template for including issues in context:
```xml
<github_issue number="123" state="open">
<title>Add dark mode support</title>
<body>
As a user, I want to toggle dark mode...
</body>
<labels>enhancement, ui</labels>
</github_issue>
```

## Implementation Phases

### Phase 1: Basic Integration (Current)
- [x] Tree view for issues
- [x] Mock data display
- [ ] Auto-detect repo info
- [ ] Basic auth check

### Phase 2: Authentication & API
- [ ] GitHub API client
- [ ] PAT storage & validation
- [ ] gh CLI integration
- [ ] Real issue fetching

### Phase 3: Enhanced UI
- [ ] Tabbed webview interface
- [ ] Issue selection persistence
- [ ] Template customization
- [ ] Import configuration

### Phase 4: Context Integration
- [ ] Include issues in generated context
- [ ] Custom formatting options
- [ ] Token counting for issues
- [ ] Issue body truncation options

## Success Metrics
1. Time from install to first issue import < 30 seconds
2. Zero config needed for public repos
3. Clear auth flow for private repos
4. Reusable pattern for 3+ integrations