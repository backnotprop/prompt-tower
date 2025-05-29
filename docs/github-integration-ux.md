# GitHub Integration UX Design

## Core Principles

1. **Lazy Loading**: Only fetch data when user explicitly requests it
2. **Clear Expectations**: Show what's happening and any limitations
3. **Progressive Enhancement**: Works without auth, better with auth
4. **Simple Mental Model**: Like folders - click to open, see contents

## User Experience Flow

### Initial State
```
📁 Files
📁 GitHub Issues (click to load)
```
- Collapsed by default
- No API calls until user clicks
- Preserves rate limit for actual use

### First Expansion
```
📂 GitHub Issues
   ⏳ Loading...
```
Then becomes:
```
📂 GitHub Issues (87 open)
   ☐ #234: Fix memory leak
   ☐ #233: Add dark mode
   ☐ #232: Update dependencies
   ...
```

### Handling Large Repositories (100+ issues)
```
📂 GitHub Issues (100+ open)
   ☐ #234: Fix memory leak
   ... (98 more) ...
   ☐ #134: Old issue
   ━━━━━━━━━━━━━━━━━━
   ℹ️ Showing 100 most recent
   🔍 [Filter Issues]
```

## API Usage Strategy

### Rate Limit Economics
- **List view**: 1 API call (up to 100 issues)
- **Context generation**: 2 calls per selected issue (details + comments)
- **Example**: Selecting 10 issues = 21 total API calls

### Unauthenticated (60/hour)
- Can list issues ~60 times
- Can generate ~3 full contexts with 10 issues each
- Natural point to encourage authentication

### Authenticated (5,000/hour)
- Effectively unlimited for normal usage
- No need for caching or complex strategies

## Authentication Flow

### When to Prompt
Only when user hits rate limit:
```
"GitHub API rate limit reached. 
Add a Personal Access Token for unlimited access.
[Add GitHub Token] [Maybe Later]"
```

### Token Setup
```
┌─────────────────────────────────────┐
│ Add GitHub Token                    │
├─────────────────────────────────────┤
│ Your token is stored securely and  │
│ never leaves your machine.          │
│                                     │
│ Token: [____________________]       │
│                                     │
│ Create token with 'repo' scope:     │
│ [Generate Token on GitHub]          │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

## Error States

### Not a GitHub Repository
```
📂 GitHub Issues
   ⚠️ Not a GitHub repository
```

### Private Repository (No Auth)
```
📂 GitHub Issues
   🔒 Authentication required
   [Add GitHub Token]
```

### Rate Limited
```
📂 GitHub Issues
   ⛔ Rate limit exceeded
   [Add Token] or try again in X minutes
```

## Future Enhancements

### Filter UI (Webview Panel)
For repos with many issues:
```
Filter GitHub Issues:
☑ bug  ☑ enhancement  ☐ documentation
☑ Open ☐ Closed
Label: [________]
Assignee: [@________]
```

### Issue Preview
Show more context in tree view:
```
☐ #234: Fix memory leak
  └─ bug, high-priority • 12 comments • @assignee
```

### Batch Operations
```
[Select All] [Select None] [Select by Label]
```

## Implementation Notes

1. **No Pagination**: Show 100 most recent, add filters if needed
2. **No Caching**: Fresh data on each expansion
3. **Comments Included**: Users expect full context
4. **Graceful Degradation**: Always show something useful

## Success Metrics

- Time to first issue load: < 2 seconds
- Clicks to see issues: 1 (expand tree)
- Clicks to add auth after rate limit: 2 (prompt → save)
- User understands what happened: Clear messages at each step