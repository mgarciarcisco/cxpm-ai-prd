#!/bin/bash
# Review Loop - Code review agent for Ralph completed tasks
# Runs after every N completed tasks to review and validate work
# Usage: ./review.sh [options]

set -euo pipefail

# =============================================================================
# Colors and formatting
# =============================================================================
if [[ -t 1 ]]; then
    BOLD="\033[1m"
    DIM="\033[2m"
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    YELLOW="\033[0;33m"
    BLUE="\033[0;34m"
    MAGENTA="\033[0;35m"
    CYAN="\033[0;36m"
    RESET="\033[0m"
else
    BOLD="" DIM="" RED="" GREEN="" YELLOW="" BLUE="" MAGENTA="" CYAN="" RESET=""
fi

log_info() { echo -e "${BLUE}[REVIEW]${RESET} $1"; }
log_success() { echo -e "${GREEN}[REVIEW]${RESET} $1"; }
log_warn() { echo -e "${YELLOW}[REVIEW]${RESET} $1"; }
log_error() { echo -e "${RED}[REVIEW]${RESET} $1"; }
print_header() { echo -e "\n${BOLD}${MAGENTA}=== $1 ===${RESET}"; }

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$SCRIPT_DIR/ralph"
MANIFEST_FILE="$RALPH_DIR/manifest.json"
REVIEW_QUEUE_FILE="$RALPH_DIR/review-queue.json"
REVIEW_PROMPT_FILE="$RALPH_DIR/review-prompt.md"
HISTORY_FILE="$RALPH_DIR/history.jsonl"
PATTERNS_FILE="$RALPH_DIR/patterns.md"
TECH_DEBT_FILE="$RALPH_DIR/tech-debt.jsonl"
LOGS_DIR="$SCRIPT_DIR/logs/reviews"

# Defaults
TOOL="claude"
BATCH_SIZE=8
DRY_RUN=false
FORCE_REVIEW=false
VERBOSE=false
STREAM=false
REVIEW_TIMEOUT=900  # 15 minutes per review

# =============================================================================
# Help
# =============================================================================

show_help() {
    cat <<EOF
${BOLD}Review Loop${RESET} - Code review agent for Ralph completed tasks

${BOLD}Usage:${RESET} ./review.sh [options]

${BOLD}Options:${RESET}
  --status            Show review queue status
  --pending           List tasks pending review
  --force             Force review even if batch not full
  --batch-size N      Override batch size (default: 8)
  --tool <name>       AI tool to use (default: claude)
  --stream            Show streaming output
  --verbose           Show raw output
  --dry-run           Preview without executing
  --approve <id>      Manually approve a task
  --reject <id>       Manually reject a task
  --help, -h          Show this help

${BOLD}Examples:${RESET}
  ./review.sh --status              Show review status
  ./review.sh --force               Review now (don't wait for batch)
  ./review.sh --approve P1-005      Manually approve task
  ./review.sh --stream              Run with streaming output

${BOLD}Workflow:${RESET}
  1. Ralph completes tasks → status: "completed"
  2. After $BATCH_SIZE tasks, run: ./review.sh
  3. Reviewer checks each task
  4. Approved → status: "reviewed"
  5. Rejected → creates FIX-XXX task (P0 priority)
EOF
}

# =============================================================================
# Parse Arguments
# =============================================================================

SHOW_STATUS=false
SHOW_PENDING=false
MANUAL_APPROVE=""
MANUAL_REJECT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h) show_help; exit 0 ;;
        --status) SHOW_STATUS=true; shift ;;
        --pending) SHOW_PENDING=true; shift ;;
        --force) FORCE_REVIEW=true; shift ;;
        --batch-size) BATCH_SIZE="$2"; shift 2 ;;
        --tool) TOOL="$2"; shift 2 ;;
        --stream) STREAM=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --approve) MANUAL_APPROVE="$2"; shift 2 ;;
        --reject) MANUAL_REJECT="$2"; shift 2 ;;
        *) log_warn "Unknown argument: $1"; shift ;;
    esac
done

# =============================================================================
# Review Queue Functions
# =============================================================================

# Get tasks completed but not yet reviewed
get_pending_reviews() {
    if [[ ! -f "$MANIFEST_FILE" ]] || [[ ! -f "$REVIEW_QUEUE_FILE" ]]; then
        echo ""
        return
    fi

    # Get completed task IDs from manifest
    local completed
    completed=$(jq -r '.tasks[] | select(.status == "completed") | .id' "$MANIFEST_FILE")

    # Get already reviewed task IDs
    local reviewed
    reviewed=$(jq -r '.reviews[].taskId' "$REVIEW_QUEUE_FILE" 2>/dev/null || echo "")

    # Find tasks that are completed but not in review queue
    for task_id in $completed; do
        if ! echo "$reviewed" | grep -q "^${task_id}$"; then
            echo "$task_id"
        fi
    done
}

# Get count of pending reviews
get_pending_count() {
    get_pending_reviews | wc -l | tr -d ' '
}

# Get task details from manifest
get_task_details() {
    local task_id=$1
    jq -r --arg id "$task_id" '.tasks[] | select(.id == $id)' "$MANIFEST_FILE"
}

# Get commit SHA for a task from history
get_task_commit() {
    local task_id=$1
    # Try to find the commit from git log
    git log --oneline --all | grep -i "$task_id" | head -1 | cut -d' ' -f1
}

# Get history entry for task
get_task_history() {
    local task_id=$1
    grep "\"task\":\"$task_id\"" "$HISTORY_FILE" 2>/dev/null | tail -1
}

# Add task to review queue
add_to_review_queue() {
    local task_id=$1
    local commit=$2
    local files=$3

    local tmp=$(mktemp)
    jq --arg id "$task_id" \
       --arg commit "$commit" \
       --arg time "$(date -Iseconds)" \
       --argjson files "$files" \
       '.reviews += [{
         "taskId": $id,
         "status": "pending",
         "submittedAt": $time,
         "commit": $commit,
         "filesChanged": $files,
         "findings": [],
         "retryCount": 0
       }]' "$REVIEW_QUEUE_FILE" > "$tmp" && mv "$tmp" "$REVIEW_QUEUE_FILE"
}

# Update review status
update_review_status() {
    local task_id=$1
    local status=$2
    local findings=${3:-"[]"}

    local tmp=$(mktemp)
    jq --arg id "$task_id" \
       --arg status "$status" \
       --arg time "$(date -Iseconds)" \
       --argjson findings "$findings" \
       '.reviews |= map(if .taskId == $id then
         .status = $status |
         .reviewedAt = $time |
         .findings = $findings
       else . end)' "$REVIEW_QUEUE_FILE" > "$tmp" && mv "$tmp" "$REVIEW_QUEUE_FILE"
}

# Mark task as reviewed in manifest
mark_task_reviewed() {
    local task_id=$1
    local tmp=$(mktemp)
    jq --arg id "$task_id" \
       '.tasks |= map(if .id == $id then .status = "reviewed" else . end)' \
       "$MANIFEST_FILE" > "$tmp" && mv "$tmp" "$MANIFEST_FILE"
    log_success "Task $task_id marked as reviewed"
}

# Create a FIX task
create_fix_task() {
    local original_task_id=$1
    local title=$2
    local description=$3
    local files=$4

    # Generate FIX task ID
    local fix_count
    fix_count=$(jq '[.tasks[] | select(.id | startswith("FIX-"))] | length' "$MANIFEST_FILE")
    local fix_id="FIX-$(printf "%03d" $((fix_count + 1)))"

    local tmp=$(mktemp)
    jq --arg id "$fix_id" \
       --arg title "$title" \
       --arg desc "$description" \
       --arg orig "$original_task_id" \
       --argjson files "$files" \
       '.tasks += [{
         "id": $id,
         "title": $title,
         "description": $desc,
         "size": "S",
         "priority": "P0",
         "dependsOn": [],
         "phase": 0,
         "status": "pending",
         "fixesTask": $orig,
         "affectedFiles": $files
       }]' "$MANIFEST_FILE" > "$tmp" && mv "$tmp" "$MANIFEST_FILE"

    # Update review queue with fix task ID
    tmp=$(mktemp)
    jq --arg id "$original_task_id" --arg fixId "$fix_id" \
       '.reviews |= map(if .taskId == $id then .fixTaskId = $fixId else . end)' \
       "$REVIEW_QUEUE_FILE" > "$tmp" && mv "$tmp" "$REVIEW_QUEUE_FILE"

    log_warn "Created fix task: $fix_id for $original_task_id"
    echo "$fix_id"
}

# Add to tech debt log
add_tech_debt() {
    local task_id=$1
    local finding=$2

    echo "{\"taskId\":\"$task_id\",\"date\":\"$(date -Iseconds)\",\"finding\":$finding}" >> "$TECH_DEBT_FILE"
}

# Show review status
show_review_status() {
    print_header "Review Status"

    local pending_count=$(get_pending_count)
    local reviewed_count=$(jq '[.reviews[] | select(.status == "approved" or .status == "rejected")] | length' "$REVIEW_QUEUE_FILE" 2>/dev/null || echo "0")
    local in_queue=$(jq '.reviews | length' "$REVIEW_QUEUE_FILE" 2>/dev/null || echo "0")

    echo ""
    printf "  ${BOLD}Pending Review:${RESET}  ${YELLOW}%d${RESET} tasks\n" "$pending_count"
    printf "  ${BOLD}In Queue:${RESET}        %d tasks\n" "$in_queue"
    printf "  ${BOLD}Reviewed:${RESET}        ${GREEN}%d${RESET} tasks\n" "$reviewed_count"
    printf "  ${BOLD}Batch Size:${RESET}      %d tasks\n" "$BATCH_SIZE"
    echo ""

    if [[ $pending_count -ge $BATCH_SIZE ]]; then
        log_info "Batch ready! Run: ./review.sh or ./review.sh --stream"
    elif [[ $pending_count -gt 0 ]]; then
        log_info "Waiting for $((BATCH_SIZE - pending_count)) more tasks to complete batch"
        log_info "Or run: ./review.sh --force to review now"
    else
        log_info "No tasks pending review"
    fi
}

# Show pending tasks
show_pending_tasks() {
    print_header "Tasks Pending Review"

    local pending=$(get_pending_reviews)
    if [[ -z "$pending" ]]; then
        log_info "No tasks pending review"
        return
    fi

    echo ""
    for task_id in $pending; do
        local title=$(jq -r --arg id "$task_id" '.tasks[] | select(.id == $id) | .title' "$MANIFEST_FILE")
        local commit=$(get_task_commit "$task_id")
        printf "  ${CYAN}%s${RESET}: %s ${DIM}(%s)${RESET}\n" "$task_id" "$title" "${commit:-no-commit}"
    done
    echo ""
}

# =============================================================================
# Manual Approve/Reject
# =============================================================================

manual_approve() {
    local task_id=$1

    # Check if task exists and is completed
    local status=$(jq -r --arg id "$task_id" '.tasks[] | select(.id == $id) | .status' "$MANIFEST_FILE")

    if [[ "$status" != "completed" ]]; then
        log_error "Task $task_id is not in 'completed' status (current: $status)"
        exit 1
    fi

    # Add to queue if not already there
    local in_queue=$(jq -r --arg id "$task_id" '.reviews[] | select(.taskId == $id) | .taskId' "$REVIEW_QUEUE_FILE")
    if [[ -z "$in_queue" ]]; then
        add_to_review_queue "$task_id" "manual" "[]"
    fi

    update_review_status "$task_id" "approved" "[]"
    mark_task_reviewed "$task_id"
    log_success "Manually approved: $task_id"
}

manual_reject() {
    local task_id=$1

    log_error "Manual rejection requires creating a FIX task"
    log_info "Please specify what needs to be fixed"
    log_info "Usage: Create FIX task manually or use the review loop"
    exit 1
}

# =============================================================================
# Review Execution
# =============================================================================

# Build review context for a task
build_review_context() {
    local task_id=$1
    local commit=$2

    local context=""

    # Task details
    local task_details=$(get_task_details "$task_id")
    local task_title=$(echo "$task_details" | jq -r '.title')
    local task_desc=$(echo "$task_details" | jq -r '.description')

    context+="## Task Under Review\n\n"
    context+="**Task ID:** $task_id\n"
    context+="**Title:** $task_title\n"
    context+="**Commit:** $commit\n\n"
    context+="**Original Description:**\n$task_desc\n\n"

    # History entry
    local history=$(get_task_history "$task_id")
    if [[ -n "$history" ]]; then
        local files=$(echo "$history" | jq -r '.files | join(", ")')
        local learnings=$(echo "$history" | jq -r '.learnings | join("; ")')
        context+="**Files Changed:** $files\n"
        context+="**Agent Learnings:** $learnings\n\n"
    fi

    # Git diff
    if [[ -n "$commit" ]] && git rev-parse "$commit" &>/dev/null; then
        context+="## Git Diff\n\n"
        context+="\`\`\`diff\n"
        context+=$(git show "$commit" --stat 2>/dev/null || echo "Could not get diff stats")
        context+="\n\`\`\`\n\n"
        context+="**Full diff available via:** \`git show $commit -p\`\n\n"
    else
        context+="## Git Diff\n\nCommit not found. Review files manually.\n\n"
    fi

    echo -e "$context"
}

# Run review for a single task
run_single_review() {
    local task_id=$1
    local commit=$2

    log_info "Reviewing task: $task_id (commit: ${commit:-unknown})"

    # Create log directory
    mkdir -p "$LOGS_DIR"
    local log_file="$LOGS_DIR/${task_id}_$(date +%Y%m%d_%H%M%S).log"

    # Build the full prompt
    local prompt_file=$(mktemp)
    cat "$REVIEW_PROMPT_FILE" > "$prompt_file"

    # Build and inject context
    local context=$(build_review_context "$task_id" "$commit")

    # Replace injection point
    if grep -q "<!-- REVIEW_INJECTION_POINT -->" "$prompt_file"; then
        local inject_line=$(grep -n "<!-- REVIEW_INJECTION_POINT -->" "$prompt_file" | head -1 | cut -d: -f1)
        {
            head -n $((inject_line - 1)) "$prompt_file"
            echo -e "$context"
            tail -n +$((inject_line + 1)) "$prompt_file"
        } > "${prompt_file}.new" && mv "${prompt_file}.new" "$prompt_file"
    else
        echo -e "\n$context" >> "$prompt_file"
    fi

    # Save prompt for debugging
    cp "$prompt_file" "$LOGS_DIR/${task_id}_prompt.md"

    local prompt_content=$(cat "$prompt_file")
    local tmpfile=$(mktemp)

    # Run the AI reviewer
    local CMD="claude --dangerously-skip-permissions --output-format stream-json --verbose"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would review $task_id"
        rm -f "$prompt_file" "$tmpfile"
        return 0
    fi

    if [[ "$STREAM" == "true" ]]; then
        echo -e "  ${DIM}[Streaming review output]${RESET}"
        timeout "$REVIEW_TIMEOUT" bash -c "$CMD -p \"\$(cat '$prompt_file')\" 2>&1" | tee "$tmpfile"
        AI_EXIT_CODE=${PIPESTATUS[0]}
    elif [[ "$VERBOSE" == "true" ]]; then
        timeout "$REVIEW_TIMEOUT" bash -c "$CMD -p \"\$(cat '$prompt_file')\" 2>&1" | tee "$tmpfile"
        AI_EXIT_CODE=${PIPESTATUS[0]}
    else
        timeout "$REVIEW_TIMEOUT" bash -c "$CMD -p \"\$(cat '$prompt_file')\" > '$tmpfile' 2>&1"
        AI_EXIT_CODE=$?
    fi

    # Save full output
    cp "$tmpfile" "$log_file"

    local output=$(cat "$tmpfile")

    # Parse the result
    if echo "$output" | grep -q "<review-complete>"; then
        local review_result=$(echo "$output" | grep -oP '(?<=<review-complete>)[^<]+(?=</review-complete>)' | head -1)
        local reviewed_id=$(echo "$review_result" | cut -d: -f1)
        local verdict=$(echo "$review_result" | cut -d: -f2)

        if [[ "$verdict" == "approved" ]]; then
            update_review_status "$task_id" "approved"
            mark_task_reviewed "$task_id"
            log_success "Task $task_id: APPROVED"

            # Check for major findings to add to tech debt
            # (would need to parse findings from output - simplified here)

        elif [[ "$verdict" == "rejected" ]]; then
            update_review_status "$task_id" "rejected"

            # Extract fix task details from output (simplified)
            local fix_title="Fix issues in $task_id"
            local fix_desc="Review found critical issues. See review log: $log_file"

            create_fix_task "$task_id" "$fix_title" "$fix_desc" "[]"
            log_error "Task $task_id: REJECTED - FIX task created"
        fi
    else
        log_warn "Task $task_id: Review did not complete properly"
        log_info "Check log: $log_file"
    fi

    # Cleanup
    rm -f "$prompt_file" "$tmpfile"
}

# Run batch review
run_batch_review() {
    local pending=$(get_pending_reviews)
    local pending_count=$(echo "$pending" | grep -c . || echo "0")

    if [[ $pending_count -eq 0 ]]; then
        log_info "No tasks to review"
        return 0
    fi

    if [[ $pending_count -lt $BATCH_SIZE ]] && [[ "$FORCE_REVIEW" != "true" ]]; then
        log_warn "Only $pending_count tasks pending (batch size: $BATCH_SIZE)"
        log_info "Use --force to review anyway"
        return 0
    fi

    print_header "Starting Batch Review"
    log_info "Tasks to review: $pending_count"

    local reviewed=0
    local approved=0
    local rejected=0

    for task_id in $pending; do
        # Get commit for this task
        local commit=$(get_task_commit "$task_id")

        # Get files from history
        local history=$(get_task_history "$task_id")
        local files="[]"
        if [[ -n "$history" ]]; then
            files=$(echo "$history" | jq '.files // []')
        fi

        # Add to review queue if not already
        local in_queue=$(jq -r --arg id "$task_id" '.reviews[] | select(.taskId == $id) | .taskId' "$REVIEW_QUEUE_FILE" 2>/dev/null)
        if [[ -z "$in_queue" ]]; then
            add_to_review_queue "$task_id" "${commit:-unknown}" "$files"
        fi

        # Update status to reviewing
        update_review_status "$task_id" "reviewing"

        # Run the review
        echo ""
        run_single_review "$task_id" "$commit"

        ((reviewed++))

        # Check result
        local status=$(jq -r --arg id "$task_id" '.reviews[] | select(.taskId == $id) | .status' "$REVIEW_QUEUE_FILE")
        if [[ "$status" == "approved" ]]; then
            ((approved++))
        elif [[ "$status" == "rejected" ]]; then
            ((rejected++))
        fi

        # Limit batch if not forcing
        if [[ "$FORCE_REVIEW" != "true" ]] && [[ $reviewed -ge $BATCH_SIZE ]]; then
            break
        fi
    done

    # Summary
    print_header "Batch Review Complete"
    printf "  ${BOLD}Reviewed:${RESET}  %d tasks\n" "$reviewed"
    printf "  ${GREEN}Approved:${RESET}  %d\n" "$approved"
    printf "  ${RED}Rejected:${RESET}  %d\n" "$rejected"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

# Ensure required files exist
if [[ ! -f "$MANIFEST_FILE" ]]; then
    log_error "Manifest not found: $MANIFEST_FILE"
    exit 1
fi

if [[ ! -f "$REVIEW_QUEUE_FILE" ]]; then
    log_error "Review queue not found: $REVIEW_QUEUE_FILE"
    log_info "Creating empty review queue..."
    echo '{"config":{"batchSize":8,"thresholds":{"rejectOn":["critical"],"trackAsDebt":["major"],"noteOnly":["minor","suggestion"]},"maxRetries":3},"reviews":[],"techDebt":[]}' > "$REVIEW_QUEUE_FILE"
fi

# Handle commands
if [[ "$SHOW_STATUS" == "true" ]]; then
    show_review_status
    exit 0
fi

if [[ "$SHOW_PENDING" == "true" ]]; then
    show_pending_tasks
    exit 0
fi

if [[ -n "$MANUAL_APPROVE" ]]; then
    manual_approve "$MANUAL_APPROVE"
    exit 0
fi

if [[ -n "$MANUAL_REJECT" ]]; then
    manual_reject "$MANUAL_REJECT"
    exit 0
fi

# Run batch review
run_batch_review
