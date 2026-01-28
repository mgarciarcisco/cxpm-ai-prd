## Critique: PRD & User Stories Implementation Plan

### Gaps and Risks
The updated plan and future-features doc meaningfully reduce v1 scope (templates, compare, advanced exports, quotas, A11y, i18n, observability). That helps. However, several concerns remain v1-critical:

- **Background task choice is unresolved**: “BackgroundTasks or Celery” is a material architectural decision. BackgroundTasks won’t survive process restarts and is not suitable for long-running or concurrent generation at scale.
- **Job lifecycle durability is unclear**: Status is stored on PRD/StoryBatch, but there is no durable job record, retry policy, or idempotency strategy to prevent duplicate generations on retries or timeouts.
- **Authorization/tenant scoping remains inconsistent**: Several read endpoints omit `current_user`, and access checks are not explicitly enforced across all read/write paths.
- **Cancellation semantics are shallow**: Setting status to cancelled doesn’t stop in-flight LLM calls, nor define partial-result handling or cleanup.
- **LLM output validation is still brittle**: Assumes clean JSON without schema validation, repair retries, or model fallback; no mention of prompt/response versioning.
- **Cost controls are UI-only**: A 30s cooldown is not a reliable guardrail; server-side limits are still needed.
- **PRD version race risk**: Version increment happens in the generator, while record creation happens in the router; concurrent generations can still collide without a single locked transaction.
- **Export format specs remain underspecified**: Markdown/JSON/CSV are declared, but schemas, field mapping, and acceptance criteria are not defined.
- **Missing key UX flows**: No PRD list/history view, no compare view in v1, and no story search/filter/sort UX beyond batch filtering.
- **Operational readiness**: Still no logging/metrics for generation duration, token usage, or failure rates; no alerting or SLOs.

### Recommendations
Prioritize v1 fixes that are foundational, and keep true enhancements in v2/v3:

- **Choose a job runner now** (Celery/RQ/etc.) and define retries, idempotency keys, and job records.
- **Enforce server-side rate limits and max payload size**; keep UI cooldown as a UX guardrail only.
- **Make auth explicit**: ensure every endpoint checks project access; document the rule in the plan.
- **Define cancellation behavior** including cooperative cancellation for workers and how partial output is handled.
- **Add schema validation + repair retries** for LLM output, and version the prompt/response contract.
- **Resolve PRD versioning race** by generating version inside a single locked transaction at creation time.
- **Specify export schemas** (fields, ordering, limits, examples) for Markdown/JSON/CSV.
- **Add minimal list/history UX** for PRDs and basic search/sort for stories to make v1 usable.
- **Add basic observability**: structured logs, generation duration, token usage, error rate.

