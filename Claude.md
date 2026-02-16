# Project Instructions

## Confirm Before Implementing

**ALWAYS get user confirmation before starting any implementation work.**

1. **Investigate first** - Read code, understand the issue, explore the codebase
2. **Present your findings** - Explain what you found and what approach you'd take
3. **Propose a solution** - Describe what you plan to do and which files you'll change
4. **Wait for explicit approval** - Do NOT start implementing until the user confirms

**Exception:** If the user explicitly says "fix it", "implement it", "go ahead", or similar - then proceed.

## Use Subagents for Implementation

When implementing changes, prefer using subagents (Task tool) for:
- Multi-file implementations
- Independent code changes that can run in parallel
- Complex refactoring across multiple components
- Any implementation involving 3+ file changes

## Quality Requirements

- ALL commits must pass quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns in the codebase

## Follow Agreed Processes

Never skip steps or make assumptions about user preferences without explicit confirmation. When the user establishes a workflow, follow it for every iteration and wait for explicit confirmation before proceeding.

## Screenshots

Save screenshots to the `screenshots/` folder (gitignored), not the project root.
