# Ralph Agent Instructions

You are an autonomous coding agent working on a software project.

> **Note:** When running via `ralph.sh`, the orchestrator injects task details into `ralph/prompt.md`.
> These instructions provide general context. The injected prompt has the specific task assignment.

## Context Files

- **Patterns:** `ralph/patterns.md` - Curated codebase patterns (READ THIS FIRST)
- **Manifest:** `ralph/manifest.json` - All tasks with dependencies and status
- **History:** `ralph/history.jsonl` - Structured completion log
- **Prompt:** `ralph/prompt.md` - Full agent instructions (used by ralph.sh)

## Your Task

**IMPORTANT: Read files ONE AT A TIME, not in parallel. Wait for each read to complete before starting the next.**

1. Read `ralph/patterns.md` - Check for relevant codebase patterns FIRST
2. Check you're on the correct branch (from manifest's `branch` field). If not, check it out or create from main.
3. Implement the assigned task completely
4. Run quality checks (typecheck, lint, test - use whatever this project requires)
5. Update CLAUDE.md files if you discover reusable patterns (see below)
6. If checks pass, commit ALL changes with message: `feat: [TASK_ID] - [Task Title]`
7. Log your completion to `ralph/history.jsonl` (see format below)
8. If you discovered a reusable pattern, add it to `ralph/patterns.md`
9. Signal completion with `<task-complete>[TASK_ID]</task-complete>`

## Logging Completion

After committing, APPEND a JSON line to `ralph/history.jsonl`:

```json
{"task":"P1-001","title":"Task Title","date":"2026-01-27T12:30:00","files":["path/to/file.ts"],"learnings":["Pattern discovered","Gotcha encountered"]}
```

**Important:** Each entry must be a single line (JSONL format). Do NOT pretty-print.

## Adding Patterns

If you discover a **reusable pattern**, add it to `ralph/patterns.md` under the appropriate section.

**Only add patterns that are:**
- General and reusable across multiple tasks
- Not task-specific implementation details
- Helpful for future iterations

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Where to put learnings:**

| Learning Type | Where to Add |
|---------------|--------------|
| Module-specific (e.g., "this component needs X") | CLAUDE.md in that directory |
| Project-wide (e.g., "use Prisma enums for status") | `ralph/patterns.md` |
| Task-specific (e.g., "files I changed") | `ralph/history.jsonl` |

**Do NOT add to CLAUDE.md:**
- Task-specific implementation details
- Temporary debugging notes
- Things already in patterns.md or history.jsonl

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal - only implement what the task requires
- Follow existing code patterns in the codebase

## Browser Testing (If Available)

For any task that changes UI, verify it works in the browser if you have browser testing tools configured (e.g., agent-browser via MCP):

1. Navigate to the relevant page
2. Verify the UI changes work as expected
3. Take a screenshot if helpful

If no browser tools are available, note that manual browser verification is needed.

## Handling Blockers

If you cannot complete the task due to missing dependencies, unclear requirements, or technical blockers:

1. Document the blocker clearly
2. End with: `<task-blocked>[TASK_ID]: [reason]</task-blocked>`

The orchestrator will handle rescheduling.

## Stop Condition

When the task is **fully complete** and **committed**:

1. Verify quality checks pass
2. Verify commit was successful
3. End your response with:

```
<task-complete>[TASK_ID]</task-complete>
```

**IMPORTANT:**
- Do NOT output `<task-complete>` unless you have actually committed working code
- Do NOT update the manifest.json status - the orchestrator handles that
- Work on ONLY the assigned task, not other tasks you might notice

## Follow Agreed Processes - CRITICAL

**NEVER skip steps or make assumptions about user preferences without explicit confirmation.**

When the user establishes a workflow (e.g., "create mockups → I'll select one → then implement"), you MUST:

1. **Follow the process for EVERY iteration** - Not just the first few
2. **Wait for explicit user confirmation** before proceeding to implementation
3. **Never assume** the user will prefer the same option as before
4. **Ask if you want to change the process** - Don't silently abandon it

**Bad behavior (DO NOT DO THIS):**
- "Based on previous choices, I'll just implement Option A"
- "These changes are straightforward, so I'll skip the mockup"
- "To save time, I'll proceed without confirmation"

**Good behavior:**
- "Here are the mockups for Page X. Which option do you prefer?"
- "Should we continue with the mockup process for the remaining pages, or would you like to proceed differently?"
- Wait for response before implementing

**Why this matters:** The user's time and preferences matter more than perceived efficiency. Skipping confirmation steps wastes their time reviewing unwanted changes and erodes trust.

## Important

- Work on ONE task per iteration
- Commit frequently (but only working code)
- Keep CI green
- Read `ralph/patterns.md` BEFORE starting work
- Log completion to `ralph/history.jsonl` AFTER committing
- The orchestrator handles task status updates - you just implement and commit

## Screenshots

**ALWAYS save screenshots to the `screenshots/` folder**, not the project root.

```bash
# Good
agent-browser screenshot screenshots/my-screenshot.png

# Bad - pollutes project root
agent-browser screenshot my-screenshot.png
```

The `screenshots/` folder is gitignored to keep the repo clean.
