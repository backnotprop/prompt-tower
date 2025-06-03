# lnr Work Management System

## Overview

lnr is an append-only, file-based lnr work management system designed for AI coding agents. Lnr work is organized into phases - coherent units of effort that match how AI agents naturally operate. The system requires no indices, no status tracking, and no complex tooling. State is derived entirely from which files exist in the directory.

## Core Principles

Lnr work happens in phases, not issues or tickets. Each phase represents a coherent push toward a specific goal. Phases can be small (refactor a function) or large (implement authentication system).

Files are immutable once created, except for progress logs which are append-only. The directory listing itself tells the complete story - an agent can understand project state instantly by seeing which files exist.

When phases need fundamental strategy changes, you create revised plans rather than editing originals. This preserves the thinking history while allowing adaptation.

## Directory Structure

<directory_structure>
\_context/lnrwork/
├── phase-001-implement-auth.md
├── phase-001-plan.md
├── phase-001-log.md
├── phase-001-completed.md
├── phase-002-add-oauth.md
├── phase-002-plan.md
├── phase-002-plan-revised.md
├── phase-002-log.md
├── phase-003-refactor-validators.md
├── phase-003-log.md
└── insight-oauth-state-handling.md
</directory_structure>

From this directory listing alone, an agent instantly knows:

- Phase 1 (implement auth) is completed
- Phase 2 (add oauth) is active with a revised plan
- Phase 3 (refactor validators) is active without a formal plan
- There's an insight about OAuth state handling

## File Naming Patterns

Phase files follow strict naming conventions that make state obvious:

- `phase-NNN-{slug}.md` - Phase definition
- `phase-NNN-plan.md` - Initial approach (optional)
- `phase-NNN-plan-revised.md` - Strategy change (if needed)
- `phase-NNN-log.md` - Progress tracking (append-only)
- `phase-NNN-completed.md` - Completion record
- `insight-{topic}.md` - Reusable learnings

The number (NNN) is zero-padded for proper sorting. The slug is a brief, descriptive identifier using hyphens.

## Phase Definition (phase-NNN-{slug}.md)

Create this when starting any new phase. It defines the goal and context. Never modify after creation.

```markdown
# Phase 001: Implement Basic Authentication

Created: 2025-06-15T10:00:00Z
Depends: none
Enables: phase-002, phase-003

## Goal

Add username/password authentication with secure session management

## Success Criteria

- User registration with email verification
- Login/logout functionality
- Session persistence across requests
- Password reset flow

## Context

Starting fresh with no existing auth system. Need foundation for future OAuth integration.
```

## Plan Files (phase-NNN-plan.md)

Create when you need to document your approach before starting. This is optional - small phases might not need formal plans.

```markdown
# Plan for Phase 001

Created: 2025-06-15T10:30:00Z

## Approach

Use bcrypt for password hashing, JWT for sessions

## Steps

1. Database schema for users table
2. Registration endpoint with validation
3. Email verification system
4. Login endpoint with JWT generation
5. Middleware for route protection
6. Password reset flow

## Technical Decisions

- JWT over server sessions for scalability
- 24-hour token expiration
- Refresh tokens for mobile apps
```

If your approach fundamentally changes, create `phase-NNN-plan-revised.md` rather than editing the original. This preserves the evolution of thinking.

## Progress Log (phase-NNN-log.md)

Create when beginning lnr work. This is the only file type that gets appended to. Each entry is timestamped and describes what happened.

```markdown
# Progress Log for Phase 001

## 2025-06-15T11:00:00Z

Created users table schema
Added bcrypt dependency
Implemented password hashing utility

## 2025-06-15T14:30:00Z

Registration endpoint complete with validation
Email verification tokens working
Discovered: need rate limiting on auth endpoints

## 2025-06-15T16:00:00Z

JWT middleware implemented
Protected routes working
Note: refresh token complexity higher than expected
```

Always append, never edit previous entries. Each entry should be self-contained.

## Completion Record (phase-NNN-completed.md)

Create only when the phase is truly done and all success criteria are met.

```markdown
# Phase 001 Completed

Completed: 2025-06-16T10:00:00Z

## Delivered

- Full authentication system with JWT sessions
- Email verification for new accounts
- Password reset via email tokens
- Rate limiting on all auth endpoints

## Key Files

- src/auth/\*
- src/middleware/authenticate.ts
- migrations/001-users-table.sql

## Unlocks

Can now proceed with phase-002 (OAuth) and phase-003 (permissions)

## Notes

Refresh token implementation more complex than expected. See insight-jwt-refresh-pattern.md
```

## Insight Files (insight-{topic}.md)

Create whenever you learn something valuable for future phases. These are project-wide learnings, not tied to specific phases.

```markdown
# Insight: JWT Refresh Token Pattern

Learned: 2025-06-16T09:00:00Z
During: phase-001

## Pattern

Store refresh tokens in httpOnly cookies, access tokens in memory.
Refresh endpoint should rotate refresh tokens on each use.

## Why

Prevents XSS attacks on tokens while maintaining usability.
Token rotation limits exposure window if refresh token compromised.

## Implementation

[Include code example if helpful]
```

## Working with lnr

When starting lnr work, scan the `_context/lnrwork` directory to understand state. Active phases have logs but no completion file. Read recent log entries to understand current progress.

If you need to understand dependencies, check phase definitions for "Depends" and "Enables" fields. This reveals the lnr work graph without needing complex tooling.

When creating new phases, number them sequentially. The numbers indicate creation order, not priority or sequence of execution. Phases can run in parallel if dependencies allow.

## State Recognition Patterns

By examining which files exist, state becomes obvious:

- **Planned**: Has `phase-NNN-*.md`, no log
- **Active**: Has `phase-NNN-log.md`, no completion
- **Completed**: Has `phase-NNN-completed.md`
- **Revised**: Has `phase-NNN-plan-revised.md`
- **Informal**: Has log but no plan (started directly)

No status fields. No database. No synchronization issues. Just files.

## Best Practices

Start phases with clear goals. Even if you skip formal planning, always create the phase definition with success criteria.

When you realize a plan won't work, create a revised plan explaining the new approach. Don't delete the original - the evolution is valuable history.

Log meaningful progress, not busy lnr work. "Tried X, didn't work because Y" is more valuable than "Working on authentication".

Create insights for patterns, not one-off fixes. If you'll need the knowledge again, document it.

## What Not to Do

Never edit files after creation (except appending to logs). History accuracy matters more than typo fixes.

Don't create status files, index files, or summary files. The directory listing is your index.

Don't use phases for tiny tasks. "Fix typo in README" doesn't need a phase. Phases represent meaningful lnr work efforts.

Don't create multiple revised plans. If you need to revise again, reconsider if this should be a new phase entirely.

## Git Integration

Each file operation should be its own commit:

- "Start phase-004: Implement caching layer"
- "Add plan for phase-004"
- "Log progress on phase-004: Redis connection established"
- "Complete phase-004"
- "Add insight: Redis connection pooling"

The Git history becomes a perfect timeline of lnr work progress.

## Summary

Just create files as you lnr work. The system emerges from the naming patterns. No tools needed beyond a text editor and Git.
