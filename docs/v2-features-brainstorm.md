# CXPM AI PRD - V2 Features Brainstorm

## Overview

This document captures the v2 feature planning for CXPM AI PRD, building on the v1 foundation of meeting notes → requirements → PRD → user stories.

**V2 Focus Areas:**
1. Authentication & Multi-User Support
2. Infrastructure & Reliability
3. Custom Templates
4. Advanced AI Capabilities

---

## 1. Authentication & Multi-User Support

### High-Level Decisions
- **Primary model:** Solo workspace with project sharing (not team-first)
- **Auth methods:** Magic Link (primary) + Google OAuth (secondary)
- **Workspace:** One account = one workspace
- **SSO:** Deferred to v3
- **Migration:** First user to sign up claims all existing v1 projects

### Detailed Decisions

| Topic | Decision |
|-------|----------|
| Magic link - multiple requests | Only latest link valid (previous invalidated) |
| Rate limiting | 3 requests per 15 minutes per email |
| Account linking | Auto-link same email (magic link + Google = same user) |
| Session storage | Server-side sessions in Redis |
| Session duration | 7 days |
| User profile required fields | Email only (name optional, can set later) |
| Invite expiry | 7 days |
| Re-invite same email | Ignore, show "already invited" |
| Removal notification | Yes, email removed member |
| Ownership transfer security | Confirmation dialog only |
| Email enumeration protection | Generic message ("If registered, you'll receive...") |
| Activity log detail | Actions + summary preview |
| Activity log retention | 1 year |
| Welcome email | Yes, on first signup |
| Invite accepted notification | Yes, email project owner |
| Activity log visibility | Owners + Editors only (not Viewers) |
| Account recovery | "Forgot email?" flow with hints (j***@gmail.com) |
| Account deletion | Must transfer all project ownership first |
| Email verification | Required (inherent in magic link / OAuth flow) |
| V1→V2 migration | First user claims all existing projects |

### Data Models

**User:**
```
User
├── id (UUID)
├── email (unique)
├── name (nullable)
├── avatar_url (nullable)
├── auth_provider (magic_link, google)
├── email_verified_at (datetime)
├── created_at
├── last_login_at
└── settings (JSON - preferences)
```

**Project Membership:**
```
ProjectMember
├── id (UUID)
├── project_id (FK → Project)
├── user_id (FK → User)
├── role (owner, editor, viewer)
├── invited_by (FK → User)
├── invited_at
└── accepted_at (nullable until accepted)
```

**Session (Redis):**
```
session:{session_id}
├── user_id
├── created_at
├── expires_at
└── ip_address (optional, for security)
```

**Activity Log:**
```
ActivityLog
├── id (UUID)
├── project_id (FK → Project)
├── user_id (FK → User)
├── action (created, updated, deleted, generated, exported)
├── entity_type (requirement, prd, story, meeting)
├── entity_id (UUID)
├── summary (human-readable, e.g., "Created requirement: User login")
└── created_at
```

### Roles & Permissions

| Role | View | Edit | Delete | Invite | See Activity | Transfer Ownership |
|------|------|------|--------|--------|--------------|-------------------|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Authentication Flows

**Magic Link Login:**
```
1. User enters email
2. Backend: check rate limit (3/15min)
3. Backend: invalidate any existing magic link tokens for this email
4. Backend: generate token (15 min expiry), store in Redis
5. Send email with link: /auth/verify?token=xxx
6. User clicks link
7. Backend: validate token, create session in Redis
8. Redirect to dashboard
9. If new user: show optional "Complete Profile" prompt
```

**Google OAuth Login:**
```
1. User clicks "Continue with Google"
2. Redirect to Google consent
3. Google redirects back with code
4. Backend: exchange code for tokens
5. Backend: get user info (email, name, avatar)
6. Backend: find or create user (auto-link if email exists)
7. Create session in Redis
8. Redirect to dashboard
```

**Logout:**
```
1. Delete session from Redis
2. Clear session cookie
3. Redirect to login page
```

### Invite Flow

**Sending Invite:**
```
1. Owner clicks "Share" on project
2. Enter email + select role (Editor/Viewer)
3. Backend: check not already member, not self-invite
4. Backend: create ProjectMember with accepted_at=null
5. Backend: generate invite token (7 day expiry)
6. Send invite email with link
7. Show "Invite sent" confirmation
```

**Accepting Invite (existing user):**
```
1. Click link in email
2. If not logged in → redirect to login, then back
3. Backend: validate token, set accepted_at
4. Redirect to project
5. Send "invite accepted" email to owner
```

**Accepting Invite (new user):**
```
1. Click link in email
2. Redirect to signup (email pre-filled)
3. Complete signup
4. Backend: auto-accept invite, set accepted_at
5. Redirect to project
6. Send "invite accepted" email to owner
```

### Email Templates Needed

| Email | Trigger | Content |
|-------|---------|---------|
| Magic Link | Login request | Link to verify (15 min expiry) |
| Welcome | First signup | Welcome + getting started tips |
| Project Invite | Owner invites | Link to accept (7 day expiry) |
| Invite Accepted | Collaborator accepts | Notify owner who joined |
| Removed from Project | Owner removes member | Notification of removal |

### Security Measures

- **Rate limiting:** 3 magic link requests per 15 min per email
- **Token expiry:** Magic link 15 min, invite 7 days, session 7 days
- **Email enumeration:** Generic responses ("If registered...")
- **Session invalidation:** On password change (future), suspicious activity
- **HTTPS only:** All auth endpoints require HTTPS

### UI Components

- Login page (email input + Google button)
- Signup completion (optional name)
- Project sharing modal
- Member list with role badges
- "My Projects" / "Shared with Me" tabs
- Activity feed (timeline view)
- Account settings (profile, delete account)
- "Forgot email?" recovery flow

### Database Changes from V1

**New tables:**
- `users`
- `project_members`
- `activity_logs`

**Modified tables:**
- `projects` → add `owner_id` (FK → users)

**Redis keys:**
- `session:{id}` - user sessions
- `magic_link:{token}` - pending magic links
- `invite:{token}` - pending invites
- `rate_limit:magic:{email}` - rate limiting

---

## 2. Infrastructure & Reliability

### High-Level Decisions
- **Job queue:** RQ (Redis Queue) - simple, Pythonic, sufficient for scale
- **Retries:** Automatic with fixed backoff, max 2 retries
- **Cancellation:** True cancellation via streaming abort, discard partial results

### Detailed Decisions

| Topic | Decision |
|-------|----------|
| Job queue | RQ (Redis Queue) |
| Max retries | 2 retries (3 total attempts) |
| Retry backoff | Fixed 30s delays |
| Cancellation - partial results | Discard (start fresh) |
| Job timeout | 3 minutes |
| Concurrent jobs per user | 1 at a time (queue additional) |
| Job history retention | 90 days |
| Job completion notification | In-app only |
| Server restart behavior | Auto-resume (RQ handles via Redis) |
| Dead jobs (after max retries) | Mark as "failed", user can manually retry |
| Health check granularity | Detailed (status per component) |
| Job visibility | Project members see jobs for their projects |
| Worker scaling | Fixed count, manually adjust |
| Error logging | Structured JSON logs |
| Graceful shutdown | Wait for current job to finish |
| Progress reporting | Yes, percentage (0-100%) |

### Job Lifecycle

```
queued → running → completed
              ↓
           failed → retry (auto, up to 2x) → completed/failed

Cancel: queued/running → cancelled (partial results discarded)
```

### Data Model

**Job:**
```
Job
├── id (UUID)
├── type (prd_generation, story_generation, meeting_extraction)
├── project_id (FK → Project)
├── user_id (FK → User)
├── status (queued, running, completed, failed, cancelled)
├── progress (0-100)
├── progress_message (e.g., "Generating section 3 of 7")
├── error_message (nullable)
├── retry_count (0, 1, or 2)
├── timeout_seconds (default 180)
├── created_at
├── started_at (nullable)
├── completed_at (nullable)
└── result_id (UUID - points to PRD/StoryBatch/etc)
```

### Retry Strategy

| Error Type | Retry? | Backoff |
|------------|--------|---------|
| LLM timeout | Yes | 30s |
| LLM rate limit | Yes | 30s |
| LLM server error (5xx) | Yes | 30s |
| Invalid input (user error) | No | - |
| No requirements | No | - |
| Parse error | Yes (1 retry) | 30s |

### Cancellation Flow

```
1. User clicks "Cancel"
2. API sets job.status = "cancelled" in DB
3. Worker checks status between LLM stream chunks
4. If cancelled → abort HTTP connection to LLM
5. Discard any partial output
6. Job marked complete with status "cancelled"
```

### Deployment Architecture

```
┌─────────────┐     ┌─────────────┐
│   API       │────▶│   Redis     │
│  (FastAPI)  │     │   (Queue +  │
└─────────────┘     │   Sessions) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Worker(s)  │
                    │    (RQ)     │
                    └─────────────┘
```

- API and Workers are separate processes
- Workers scale independently (start with 1-2, adjust manually)
- Graceful shutdown: worker finishes current job before stopping
- On server restart: queued jobs auto-resume via Redis persistence

### Health Endpoints

**`GET /health`** - Basic liveness
```json
{ "status": "ok" }
```

**`GET /ready`** - Detailed readiness
```json
{
  "status": "ok",
  "components": {
    "database": "ok",
    "redis": "ok",
    "workers": { "count": 2, "status": "ok" }
  }
}
```

### Job Visibility UI

**Who sees what:**
- Users see jobs for projects they have access to
- Filter by: status, type, project
- Actions: Cancel (if running), Retry (if failed)
- Show: progress %, duration, error message

**Job list columns:**
- Type (PRD / Stories / Meeting)
- Project name
- Status (with progress bar if running)
- Started / Duration
- Actions

### Logging

Structured JSON logs for all job events:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "event": "job_started",
  "job_id": "uuid",
  "job_type": "prd_generation",
  "project_id": "uuid",
  "user_id": "uuid"
}
```

Key events logged:
- `job_queued`
- `job_started`
- `job_progress` (with percentage)
- `job_completed`
- `job_failed` (with error details)
- `job_cancelled`
- `job_retry`

---

## 3. Custom Templates

### High-Level Decisions
- **Template types:** PRD templates, Story templates
- **Extraction templates:** Deferred to v3
- **Template sharing:** Deferred to v3 (personal only for v2)
- **Prompt editing:** Not exposed (use guidance fields instead)

### Detailed Decisions

| Topic | Decision |
|-------|----------|
| Template sharing | Defer to v3 (personal only) |
| Duplicate system templates | Yes, creates editable copy |
| Template deletion | Cascade - projects fall back to system default |
| Template versioning | Keep last 5 versions, can restore |
| PRD minimum sections | Required: Executive Summary + Problem Statement |
| Section guidance length | 500 characters max |
| Maximum sections per template | Hard cap at 20 |
| Custom story format | Yes, allow custom format strings |
| Acceptance criteria styles | Gherkin, checklist, or freeform |
| Default labels limit | 5 max per template |
| Section reordering | Drag and drop |
| Template preview | Sample content with placeholders |
| Template description | Optional field |
| Story size scale | T-shirt only (XS, S, M, L, XL) |

### Data Model

**Template:**
```
Template
├── id (UUID)
├── name (required)
├── description (optional, for user reference)
├── type (prd, story)
├── owner_id (FK → User, null for system templates)
├── is_system (boolean)
├── config (JSON - see below)
├── created_at
├── updated_at
└── deleted_at (soft delete)
```

**Template Version (for restore):**
```
TemplateVersion
├── id (UUID)
├── template_id (FK → Template)
├── version_number (1-5, rolling)
├── config (JSON snapshot)
├── created_at
```

### Template Tiers

1. **System templates** - Built-in, read-only, cannot delete
   - PRD: Draft, Detailed
   - Stories: Classic, Job Story
2. **User templates** - Created by duplicating system or from scratch
3. **Project default** - Each project can select a default template

### PRD Template Config

```json
{
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "required": true,
      "guidance": "2-3 paragraphs max. Focus on business value. (max 500 chars)"
    },
    {
      "id": "problem_statement",
      "title": "Problem Statement",
      "required": true,
      "guidance": "What pain point? For whom?"
    },
    {
      "id": "custom_section",
      "title": "Compliance & Legal",
      "required": false,
      "guidance": "GDPR, HIPAA considerations if applicable"
    }
  ],
  "general_instructions": "Use formal tone. Include cost estimates."
}
```

**Constraints:**
- Minimum 2 sections (Executive Summary + Problem Statement required)
- Maximum 20 sections
- Guidance max 500 characters per section

### Story Template Config

```json
{
  "format": "classic",
  "custom_format": null,
  "acceptance_criteria_style": "gherkin",
  "required_fields": ["acceptance_criteria", "size"],
  "default_labels": ["needs-review", "backend"],
  "size_scale": "tshirt",
  "general_instructions": "Keep stories sprint-sized"
}
```

**Format options:**
- `classic` - "As a [user], I want [goal], so that [benefit]"
- `job_story` - "When [situation], I want [action], so I can [outcome]"
- `custom` - Uses `custom_format` field, e.g., "As a {role}, I need {goal} because {reason}"

**AC style options:**
- `gherkin` - Given/When/Then format
- `checklist` - Simple bullet points
- `freeform` - Unstructured text

**Constraints:**
- Max 5 default labels
- Size scale: T-shirt only (XS, S, M, L, XL)

### Template Editor UI

**Features:**
- Drag and drop section reordering
- Add/remove sections (within limits)
- Per-section: title, required toggle, guidance textarea
- General instructions field
- Preview with sample placeholder content
- "Duplicate" button on system templates
- Version history dropdown (last 5, can restore)

**Validation:**
- Name required
- At least 2 sections for PRD
- Executive Summary + Problem Statement required for PRD
- Max 20 sections
- Max 500 chars per guidance field
- Max 5 default labels for stories

### Template Selection Flow

**When generating PRD/Stories:**
1. Show template dropdown
2. Options: System templates + User templates
3. Star icon for project default (if set)
4. "Manage templates" link to settings

**Project settings:**
- Set default PRD template
- Set default Story template
- Falls back to system default if custom deleted

---

## 4. Advanced AI Capabilities

### High-Level Decisions
- **Include in v2:** Semantic search, Quality scoring, Gap analysis
- **Defer to v2.5/v3:** Proactive suggestions

### Detailed Decisions

| Topic | Decision |
|-------|----------|
| Embedding model | Local via Ollama (e.g., nomic-embed-text) |
| Embedding timing | Background job (doesn't block saves) |
| What gets embedded | Requirements and stories only |
| Search scope | Toggle: single project or cross-project |
| "Find similar" | Yes, across all accessible projects |
| Quality dimensions | 4: Clarity, Completeness, Testability, Specificity |
| Score display | Color badge (red/yellow/green) |
| Quality details | Click badge to expand inline |
| Quality trigger | On demand ("Score requirements" button) |
| "Improve with AI" | Yes, generates rewrite suggestions |
| Gap analysis scope | Comprehensive (stories, AC, NFRs, orphans, duplicates) |
| Gap analysis trigger | Auto (hourly) + manual refresh |
| Gap display | Dashboard widget + dedicated page |
| Gap actions | Quick fix buttons ("Generate stories", "Add AC") |
| AI results caching | Cache until content changes |

### 4.1 Semantic Search

**Problem:** LIKE queries miss semantic matches ("auth" vs "login")

**Solution:** Local embeddings via Ollama + pgvector

**Data Model:**
```
ContentEmbedding
├── id (UUID)
├── entity_type (requirement, story)
├── entity_id (FK)
├── embedding (vector, dimension depends on model)
├── model_name (e.g., "nomic-embed-text")
├── model_version
└── created_at
```

**Embedding Generation:**
- Triggered as background job when requirement/story is created or updated
- Queue job → worker generates embedding → store in DB
- If Ollama unavailable, mark as "pending" and retry later

**Search Features:**
- **Search bar** - Enter query, find semantically similar items
- **Scope toggle** - Search current project or all accessible projects
- **"Find similar" button** - On any requirement/story, find related items across all projects

**Search Results:**
- Ranked by similarity score
- Show entity type, title, snippet, project name
- Click to navigate to item

### 4.2 Requirement Quality Scoring

**Dimensions (4):**

| Dimension | What it checks | Example Feedback |
|-----------|----------------|------------------|
| Clarity | Unambiguous language | "Define 'fast' - what response time?" |
| Completeness | Has context, rationale | "Missing success criteria" |
| Testability | Can write a test | "How would you verify 'intuitive'?" |
| Specificity | Concrete details | "Which user role does this apply to?" |

**Score Calculation:**
- LLM analyzes requirement text
- Returns score per dimension (0-100) + feedback
- Overall score = average of dimensions
- Badge color: Green (70+), Yellow (40-69), Red (<40)

**UI Flow:**
```
1. User clicks "Score Requirements" button
2. Background job queued for all requirements in project
3. Progress shown: "Scoring 12 requirements..."
4. Results cached, badges appear on each requirement
5. Click badge → expand inline to see:
   - Dimension breakdown
   - Specific feedback per dimension
   - "Improve with AI" button
```

**"Improve with AI" Flow:**
```
1. User clicks "Improve with AI" on a requirement
2. LLM generates 1-3 rewrite suggestions
3. User can:
   - Accept a suggestion (replaces content)
   - Edit suggestion before accepting
   - Dismiss and write manually
```

**Caching:**
- Store scores in DB linked to requirement
- Invalidate when requirement content changes
- Re-score on next manual trigger

### 4.3 Gap Analysis

**What Gets Analyzed:**

| Gap Type | Detection | Quick Fix Action |
|----------|-----------|------------------|
| Requirements without stories | Count reqs with no linked stories | "Generate Stories" |
| Stories without AC | Stories where AC array is empty | "Add AC" (opens editor) |
| Missing NFRs | Check for security/performance/accessibility sections | "Add NFR Requirement" |
| Orphaned stories | Stories linking to deleted requirements | "Remove Link" or "Delete Story" |
| Potential duplicates | Semantic similarity > 0.9 between items | "Review Duplicates" |

**Trigger:**
- **Automatic:** Hourly background job per project
- **Manual:** "Refresh Analysis" button

**UI - Dashboard Widget:**
```
┌─────────────────────────────────┐
│ Project Health          [View] │
├─────────────────────────────────┤
│ Coverage: 78%  ●●●●●●●○○○      │
│                                 │
│ ⚠ 5 requirements without stories│
│ ⚠ 3 stories missing AC         │
│ ✓ NFRs covered                  │
└─────────────────────────────────┘
```

**UI - Dedicated Page:**
- Full breakdown by gap type
- List of affected items with links
- Quick fix buttons per item
- Filter by gap type
- "Last analyzed: 2 hours ago" + refresh button

**Caching:**
- Store analysis results in DB per project
- Update hourly via background job
- Invalidate on manual refresh

### 4.4 Proactive Suggestions (Deferred to v2.5/v3)

Not in v2. Would include:
- Real-time duplicate detection as you type
- Story splitting suggestions for XL stories
- Automatic vague requirement detection
- Missing edge case alerts
- "You might also want to add..." suggestions

---

## Implementation Phases (Suggested Order)

### Phase 2.1: Foundation (Auth + Infrastructure)
**Prerequisites for everything else**

1. Set up Redis (shared by auth sessions + job queue)
2. User model + authentication (magic link + Google OAuth)
3. Session management in Redis
4. RQ job queue setup with workers
5. Health endpoints
6. Project ownership migration (v1 → v2)

### Phase 2.2: Multi-User Features
**Build on auth foundation**

1. Project sharing (invites, roles, permissions)
2. Activity logging
3. Email notifications (magic link, invites, etc.)
4. Job visibility UI
5. Account settings (profile, deletion flow)

### Phase 2.3: Custom Templates
**Independent of auth, can parallel with 2.2**

1. Template model + versioning
2. System templates (PRD + Story defaults)
3. Template editor UI
4. Template selection in generation flow
5. Project default template settings

### Phase 2.4: Advanced AI
**Requires job queue from 2.1**

1. Embedding service (Ollama integration)
2. Semantic search + "Find similar"
3. Quality scoring service
4. Gap analysis service
5. Dashboard widgets + health page
6. "Improve with AI" feature

---

## Dependencies Diagram

```
┌──────────────────┐
│  Phase 2.1       │
│  Foundation      │
│  (Auth + Jobs)   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌───────────┐
│ 2.2   │  │ 2.3       │
│ Multi │  │ Templates │
│ User  │  │ (parallel)│
└───┬───┘  └───────────┘
    │
    ▼
┌───────┐
│ 2.4   │
│ AI    │
└───────┘
```

---

## Open Questions (For Implementation)

- [ ] Exact Ollama embedding model to use (nomic-embed-text vs alternatives)
- [ ] Email service provider (SendGrid, Postmark, AWS SES)
- [ ] Redis hosting (managed vs self-hosted)
- [ ] pgvector setup for Postgres
- [ ] Detailed API endpoint design
- [ ] UI component library choices
- [ ] E2E testing strategy for auth flows
- [ ] Deployment platform (Vercel, Railway, self-hosted)

---

## Summary of V2 Scope

| Feature Area | Included | Deferred |
|--------------|----------|----------|
| **Auth** | Magic link, Google OAuth, sessions, sharing, roles | SSO/SAML |
| **Infrastructure** | RQ jobs, retries, cancellation, health checks | Auto-scaling |
| **Templates** | PRD + Story templates, versioning, editor | Sharing, extraction templates |
| **AI** | Semantic search, quality scoring, gap analysis | Proactive suggestions |
