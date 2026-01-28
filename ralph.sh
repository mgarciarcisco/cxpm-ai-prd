#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Requires: bash 4.0+, jq, bc (optional for cost calculation)
# Usage: ./ralph.sh [options] [max_iterations]

set -euo pipefail

# =============================================================================
# OPTION - Colors and formatting
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

log_info() { echo -e "${BLUE}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $1"; }
print_header() { echo -e "\n${BOLD}${CYAN}=== $1 ===${RESET}"; }

# Safe process termination
safe_kill() {
    local pid=${1:-}
    [[ -z "$pid" ]] && return 0
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
}

# =============================================================================
# HELP
# =============================================================================

show_help() {
    cat <<EOF
${BOLD}Ralph Wiggum${RESET} - Long-running AI agent loop with dependency-aware task execution

${BOLD}Usage:${RESET} ./ralph.sh [options] [max_iterations]

${BOLD}Options:${RESET}
  --init              Initialize Ralph config for current project
  --config            Show current configuration
  --manifest <file>   Use specified manifest file (default: ralph/manifest.json)
  --prd <file>        Alias for --manifest (legacy support)
  --tool <name>       Use specified AI tool (claude, cursor, opencode, codex, droid, copilot, gemini)
  --cursor            Shorthand for --tool cursor
  --opencode          Shorthand for --tool opencode
  --codex             Shorthand for --tool codex
  --droid             Shorthand for --tool droid
  --copilot           Shorthand for --tool copilot
  --model <name>      Override model selection
  --browser           Enable browser automation
  --no-browser        Disable browser automation
  --stream            Show formatted real-time agent output (recommended)
  --verbose           Show raw JSON stream output (for debugging)
  --dry-run           Preview actions without executing AI
  --status            Show task status summary and exit
  --resume            Resume from last saved state after crash/interrupt
  --help, -h          Show this help message

${BOLD}Examples:${RESET}
  ./ralph.sh 5                                Run 5 iterations with default tool
  ./ralph.sh --cursor 10                      Run 10 iterations using Cursor
  ./ralph.sh --manifest custom/tasks.json 5   Use custom manifest file
  ./ralph.sh --stream 3                       Show formatted streaming output
  ./ralph.sh --status                         Show task dependency status
  ./ralph.sh --dry-run                        Preview without running

${BOLD}File Structure:${RESET}
  ralph/manifest.json   Task definitions with dependencies
  ralph/progress.txt    Progress log and codebase patterns
  ralph/prompt.md       Agent instructions

${BOLD}Configuration:${RESET}
  Run ${CYAN}./ralph.sh --init${RESET} to auto-detect project settings.
  Config stored in: .ralphrc
EOF
}

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.ralphrc"
RALPH_DIR="$SCRIPT_DIR/ralph"
MANIFEST_FILE="${MANIFEST_FILE:-$RALPH_DIR/manifest.json}"
PATTERNS_FILE="$RALPH_DIR/patterns.md"
HISTORY_FILE="$RALPH_DIR/history.jsonl"
PROMPT_FILE="${PROMPT_FILE:-$RALPH_DIR/prompt.md}"

# Legacy - keep for backward compatibility
PROGRESS_FILE="$RALPH_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LOGS_BASE_DIR="$SCRIPT_DIR/logs"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Legacy support - map PRD_FILE to MANIFEST_FILE if provided
PRD_FILE="${PRD_FILE:-}"
if [[ -n "$PRD_FILE" ]]; then
    MANIFEST_FILE="$PRD_FILE"
fi

# Defaults
TOOL="claude"
MAX_ITERATIONS=10
BROWSER_ENABLED="auto"
MODEL_OVERRIDE=""
INIT_MODE=false
SHOW_CONFIG=false
SHOW_STATUS=false
DRY_RUN=false
VERBOSE=false
STREAM=false
RESUME_MODE=false

# Resilience settings
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-30}
MAX_CONSECUTIVE_FAILURES=${MAX_CONSECUTIVE_FAILURES:-3}
RATE_LIMIT_WAIT=${RATE_LIMIT_WAIT:-60}
TASK_TIMEOUT=${TASK_TIMEOUT:-600}  # 10 minutes per task

# Configurable pricing (per million tokens) - can be overridden in .ralphrc
INPUT_PRICE_PER_M="${INPUT_PRICE_PER_M:-3}"
OUTPUT_PRICE_PER_M="${OUTPUT_PRICE_PER_M:-15}"

# Configurable completion markers
TASK_COMPLETE_PATTERN="<task-complete>"
TASK_BLOCKED_PATTERN="<task-blocked>"
ALL_COMPLETE_MARKER="${ALL_COMPLETE_MARKER:-<promise>COMPLETE</promise>}"

# Global state for tracking
current_step="Thinking"
total_input_tokens=0
total_output_tokens=0
total_cost="0"
total_duration_ms=0
monitor_pid=""
ai_pid=""
tmpfile=""

# Load config if exists (with validation)
if [ -f "$CONFIG_FILE" ]; then
    # Security: check for unsafe characters before sourcing
    if grep -qE '^[^#]*[;&|`$()]' "$CONFIG_FILE" 2>/dev/null; then
        log_error "Config file contains unsafe characters. Please review: $CONFIG_FILE"
        exit 1
    fi
    # shellcheck source=/dev/null
    source "$CONFIG_FILE"
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --help|-h)
      show_help
      exit 0
      ;;
    --init)
      INIT_MODE=true
      shift
      ;;
    --config)
      SHOW_CONFIG=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --cursor)
      TOOL="cursor"
      shift
      ;;
    --opencode)
      TOOL="opencode"
      shift
      ;;
    --codex)
      TOOL="codex"
      shift
      ;;
    --droid)
      TOOL="droid"
      shift
      ;;
    --copilot)
      TOOL="copilot"
      shift
      ;;
    --browser)
      BROWSER_ENABLED="true"
      shift
      ;;
    --no-browser)
      BROWSER_ENABLED="false"
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --stream)
      STREAM=true
      shift
      ;;
    --model)
      MODEL_OVERRIDE="$2"
      shift 2
      ;;
    --manifest)
      MANIFEST_FILE="$2"
      # Convert relative path to absolute
      if [[ ! "$MANIFEST_FILE" = /* ]]; then
        MANIFEST_FILE="$SCRIPT_DIR/$MANIFEST_FILE"
      fi
      shift 2
      ;;
    --manifest=*)
      MANIFEST_FILE="${1#*=}"
      # Convert relative path to absolute
      if [[ ! "$MANIFEST_FILE" = /* ]]; then
        MANIFEST_FILE="$SCRIPT_DIR/$MANIFEST_FILE"
      fi
      shift
      ;;
    --prd)
      # Legacy support - map to manifest
      MANIFEST_FILE="$2"
      if [[ ! "$MANIFEST_FILE" = /* ]]; then
        MANIFEST_FILE="$SCRIPT_DIR/$MANIFEST_FILE"
      fi
      shift 2
      ;;
    --prd=*)
      # Legacy support - map to manifest
      MANIFEST_FILE="${1#*=}"
      if [[ ! "$MANIFEST_FILE" = /* ]]; then
        MANIFEST_FILE="$SCRIPT_DIR/$MANIFEST_FILE"
      fi
      shift
      ;;
    --status)
      SHOW_STATUS=true
      shift
      ;;
    --resume)
      RESUME_MODE=true
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      else
        log_warn "Unknown argument: $1"
      fi
      shift
      ;;
  esac
done

# =============================================================================
# INIT & PROJECT DETECTION
# =============================================================================

init_ralph() {
    print_header "Initializing Ralph"
    
    if [ -f "$CONFIG_FILE" ]; then
        log_warn "Config file already exists at $CONFIG_FILE"
        read -p "Overwrite? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    PROJECT_NAME=$(basename "$PWD")
    LANG="Unknown"
    FRAMEWORK=""
    TEST_CMD=""
    LINT_CMD=""

    if [ -f "package.json" ]; then
        if [ -f "tsconfig.json" ]; then LANG="TypeScript"; else LANG="JavaScript"; fi
        if grep -q "next" package.json; then FRAMEWORK="Next.js"; fi
        if grep -q "react" package.json; then FRAMEWORK="React"; fi
        if grep -q "\"test\":" package.json; then TEST_CMD="npm test"; fi
        if grep -q "\"lint\":" package.json; then LINT_CMD="npm run lint"; fi
    elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
        LANG="Python"
        if [ -f "manage.py" ]; then FRAMEWORK="Django"; fi
        TEST_CMD="pytest"
    elif [ -f "go.mod" ]; then
        LANG="Go"
        TEST_CMD="go test ./..."
    elif [ -f "Cargo.toml" ]; then
        LANG="Rust"
        TEST_CMD="cargo test"
    fi

    cat > "$CONFIG_FILE" << EOF
# Ralph Configuration
PROJECT_NAME="$PROJECT_NAME"
PROJECT_LANG="$LANG"
PROJECT_FRAMEWORK="$FRAMEWORK"
TEST_COMMAND="$TEST_CMD"
LINT_COMMAND="$LINT_CMD"
# Default Tool (can be overridden by --tool flags)
TOOL="${TOOL}"
# Browser capability (auto, true, false)
BROWSER_ENABLED="auto"
EOF

    log_success "Initialized config at $CONFIG_FILE"
    log_info "Project: $PROJECT_NAME ($LANG $FRAMEWORK)"
    log_info "Test Command: $TEST_CMD"
}

if [ "$INIT_MODE" = true ]; then
    init_ralph
    exit 0
fi

if [ "$SHOW_CONFIG" = true ]; then
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        log_warn "No config file found."
    fi
    exit 0
fi

# Show status mode - deferred until after function definitions
# (see SHOW_STATUS handling after TASK FUNCTIONS section)

# =============================================================================
# CLEANUP HANDLER
# =============================================================================

cleanup() {
    local exit_code=$?

    # Kill background processes safely
    safe_kill "${monitor_pid:-}"
    safe_kill "${ai_pid:-}"

    # Remove temp file
    [[ -n "${tmpfile:-}" ]] && rm -f "$tmpfile"

    # Show message on interrupt
    if [[ $exit_code -eq 130 ]]; then
        printf "\n"
        log_warn "Interrupted! State saved."
        log_info "Run with --resume to continue from where you left off."
    fi
}

trap cleanup EXIT INT TERM QUIT PIPE HUP

# =============================================================================
# PROGRESS MONITOR
# =============================================================================

monitor_progress() {
    local file=$1
    local task=$2
    local start_time
    start_time=$(date +%s)
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local spin_idx=0
    
    task="${task:0:40}"
    
    while true; do
        local elapsed=$(($(date +%s) - start_time))
        local mins=$((elapsed / 60))
        local secs=$((elapsed % 60))
        
        # Check latest output for step indicators
        if [[ -f "$file" ]] && [[ -s "$file" ]]; then
            local content
            content=$(tail -c 5000 "$file" 2>/dev/null || true)
            
            if echo "$content" | grep -qE 'git commit|"command":"git commit'; then
                current_step="Committing"
            elif echo "$content" | grep -qE 'git add|"command":"git add'; then
                current_step="Staging"
            elif echo "$content" | grep -qE 'progress\.txt'; then
                current_step="Logging"
            elif echo "$content" | grep -qE 'PRD\.md|prd\.json'; then
                current_step="Updating PRD"
            elif echo "$content" | grep -qE 'lint|eslint|biome|prettier'; then
                current_step="Linting"
            elif echo "$content" | grep -qE 'vitest|jest|bun test|npm test|pytest|go test'; then
                current_step="Testing"
            elif echo "$content" | grep -qE '\.test\.|\.spec\.|__tests__|_test\.go'; then
                current_step="Writing tests"
            elif echo "$content" | grep -qE '"tool":"[Ww]rite"|"tool":"[Ee]dit"|"name":"write"|"name":"edit"'; then
                current_step="Implementing"
            elif echo "$content" | grep -qE '"tool":"[Rr]ead"|"tool":"[Gg]lob"|"tool":"[Gg]rep"|"name":"read"|"name":"glob"|"name":"grep"'; then
                current_step="Reading code"
            fi
        fi
        
        local spinner_char="${spinstr:$spin_idx:1}"
        local step_color=""
        
        # Color-code steps
        case "$current_step" in
            "Thinking"|"Reading code") step_color="$CYAN" ;;
            "Implementing"|"Writing tests") step_color="$MAGENTA" ;;
            "Testing"|"Linting") step_color="$YELLOW" ;;
            "Staging"|"Committing") step_color="$GREEN" ;;
            *) step_color="$BLUE" ;;
        esac
        
        # Clear line and print progress
        printf "\r\033[K  %s ${step_color}%-16s${RESET} │ %s ${DIM}[%02d:%02d]${RESET}" "$spinner_char" "$current_step" "$task" "$mins" "$secs"
        
        spin_idx=$(( (spin_idx + 1) % ${#spinstr} ))
        sleep 0.12
    done
}

# =============================================================================
# TOKEN/COST PARSING
# =============================================================================

parse_ai_result() {
    local result=$1
    local response=""
    local input_tokens=0
    local output_tokens=0
    local actual_cost="0"
    
    case "$TOOL" in
        opencode)
            # OpenCode JSON format
            local step_finish
            step_finish=$(echo "$result" | grep '"type":"step_finish"' | tail -1 || echo "")
            
            if [[ -n "$step_finish" ]]; then
                input_tokens=$(echo "$step_finish" | jq -r '.part.tokens.input // 0' 2>/dev/null || echo "0")
                output_tokens=$(echo "$step_finish" | jq -r '.part.tokens.output // 0' 2>/dev/null || echo "0")
                actual_cost=$(echo "$step_finish" | jq -r '.part.cost // 0' 2>/dev/null || echo "0")
            fi
            response=$(echo "$result" | grep '"type":"text"' | jq -rs 'map(.part.text // "") | join("")' 2>/dev/null || echo "")
            [[ -z "$response" ]] && response="Task completed"
            ;;
        cursor)
            # Cursor agent: parse stream-json output
            local result_line
            result_line=$(echo "$result" | grep '"type":"result"' | tail -1)
            
            if [[ -n "$result_line" ]]; then
                response=$(echo "$result_line" | jq -r '.result // "Task completed"' 2>/dev/null || echo "Task completed")
                local duration_ms
                duration_ms=$(echo "$result_line" | jq -r '.duration_ms // 0' 2>/dev/null || echo "0")
                if [[ "$duration_ms" =~ ^[0-9]+$ ]] && [[ "$duration_ms" -gt 0 ]]; then
                    actual_cost="duration:$duration_ms"
                fi
            fi
            ;;
        codex)
            response=$(echo "$result" | tail -20 || echo "Task completed")
            ;;
        droid)
            # Droid stream-json parsing
            local completion_line
            completion_line=$(echo "$result" | grep '"type":"completion"' | tail -1)
            
            if [[ -n "$completion_line" ]]; then
                response=$(echo "$completion_line" | jq -r '.finalText // "Task completed"' 2>/dev/null || echo "Task completed")
                local dur_ms
                dur_ms=$(echo "$completion_line" | jq -r '.durationMs // 0' 2>/dev/null || echo "0")
                if [[ "$dur_ms" =~ ^[0-9]+$ ]] && [[ "$dur_ms" -gt 0 ]]; then
                    actual_cost="duration:$dur_ms"
                fi
            fi
            ;;
        copilot)
            response=$(echo "$result" | grep -v "^?" | grep -v "^❯" | grep -v "Thinking..." | head -20 | tail -10 || echo "Task completed")
            ;;
        gemini)
            response=$(echo "$result" | tail -20 || echo "Task completed")
            ;;
        claude|*)
            # Claude Code stream-json parsing
            local result_line
            result_line=$(echo "$result" | grep '"type":"result"' | tail -1)
            
            if [[ -n "$result_line" ]]; then
                response=$(echo "$result_line" | jq -r '.result // "No result text"' 2>/dev/null || echo "Could not parse result")
                input_tokens=$(echo "$result_line" | jq -r '.usage.input_tokens // 0' 2>/dev/null || echo "0")
                output_tokens=$(echo "$result_line" | jq -r '.usage.output_tokens // 0' 2>/dev/null || echo "0")
            fi
            ;;
    esac
    
    # Sanitize token counts
    [[ "$input_tokens" =~ ^[0-9]+$ ]] || input_tokens=0
    [[ "$output_tokens" =~ ^[0-9]+$ ]] || output_tokens=0
    
    echo "$response"
    echo "---TOKENS---"
    echo "$input_tokens"
    echo "$output_tokens"
    echo "$actual_cost"
}

calculate_cost() {
    local input=$1
    local output=$2
    
    # Configurable pricing (defaults: $3/M input, $15/M output)
    if command -v bc &>/dev/null; then
        local input_rate output_rate
        input_rate=$(echo "scale=9; $INPUT_PRICE_PER_M / 1000000" | bc)
        output_rate=$(echo "scale=9; $OUTPUT_PRICE_PER_M / 1000000" | bc)
        echo "scale=4; ($input * $input_rate) + ($output * $output_rate)" | bc
    else
        # Fallback: rough bash integer math (less precise but works)
        local cost_cents=$(( (input * INPUT_PRICE_PER_M / 10000) + (output * OUTPUT_PRICE_PER_M / 10000) ))
        echo "0.$cost_cents"
    fi
}

format_tokens() {
    local tokens=$1
    if [[ $tokens -ge 1000000 ]]; then
        printf "%.1fM" "$(echo "scale=1; $tokens / 1000000" | bc 2>/dev/null || echo "0")"
    elif [[ $tokens -ge 1000 ]]; then
        printf "%.1fK" "$(echo "scale=1; $tokens / 1000" | bc 2>/dev/null || echo "0")"
    else
        echo "$tokens"
    fi
}

# Reusable session summary display
print_session_summary() {
    local duration=$1
    local iterations=$2
    
    echo ""
    echo "${BOLD}━━━ Session Summary ━━━${RESET}"
    printf "  Duration:      %dm %ds\n" $((duration / 60)) $((duration % 60))
    printf "  Iterations:    %d\n" "$iterations"
    
    if [[ $total_input_tokens -gt 0 ]] || [[ $total_output_tokens -gt 0 ]]; then
        printf "  Total Tokens:  ${CYAN}%s${RESET} in / ${CYAN}%s${RESET} out\n" \
            "$(format_tokens $total_input_tokens)" "$(format_tokens $total_output_tokens)"
        local session_cost
        session_cost=$(calculate_cost "$total_input_tokens" "$total_output_tokens")
        printf "  Est. Cost:     ${YELLOW}\$%s${RESET}\n" "$session_cost"
    fi
    
    if [[ "$total_cost" != "0" ]] && command -v bc &>/dev/null; then
        printf "  Actual Cost:   ${YELLOW}\$%s${RESET}\n" "$total_cost"
    fi
    
    echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

# =============================================================================
# STREAMING FORMATTERS
# =============================================================================

# Format Claude/Cursor stream-json output for human-readable display
stream_format_claude() {
    local tmpfile=$1
    local current_tool=""
    local in_text_block=false
    
    # Use tee to capture to file while parsing for display
    tee "$tmpfile" | while IFS= read -r line; do
        # Skip empty lines
        [[ -z "$line" ]] && continue
        
        # Try to parse as JSON
        local type
        type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null) || continue
        
        case "$type" in
            "assistant")
                # Assistant message with content blocks
                local text
                text=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
                if [[ -n "$text" ]]; then
                    echo ""
                    echo -e "${CYAN}$text${RESET}"
                fi
                ;;
            "content_block_start")
                local block_type
                block_type=$(echo "$line" | jq -r '.content_block.type // empty' 2>/dev/null)
                if [[ "$block_type" == "tool_use" ]]; then
                    current_tool=$(echo "$line" | jq -r '.content_block.name // empty' 2>/dev/null)
                    echo ""
                    echo -e "${YELLOW}━━━ $current_tool${RESET}"
                elif [[ "$block_type" == "text" ]]; then
                    in_text_block=true
                fi
                ;;
            "content_block_delta")
                local delta_type
                delta_type=$(echo "$line" | jq -r '.delta.type // empty' 2>/dev/null)
                
                if [[ "$delta_type" == "text_delta" ]]; then
                    local text
                    text=$(echo "$line" | jq -r '.delta.text // empty' 2>/dev/null)
                    [[ -n "$text" ]] && printf "%s" "$text"
                elif [[ "$delta_type" == "input_json_delta" ]]; then
                    # Tool input streaming - we can extract useful info
                    :
                fi
                ;;
            "content_block_stop")
                if [[ "$in_text_block" == true ]]; then
                    echo ""
                    in_text_block=false
                fi
                current_tool=""
                ;;
            "tool_use")
                # Full tool use event (some tools send this instead of content_block_start)
                local tool_name input_preview
                tool_name=$(echo "$line" | jq -r '.name // empty' 2>/dev/null)
                
                echo ""
                echo -e "${YELLOW}━━━ $tool_name${RESET}"
                
                # Show relevant input based on tool type
                case "$tool_name" in
                    Read|read)
                        local path
                        path=$(echo "$line" | jq -r '.input.path // empty' 2>/dev/null)
                        [[ -n "$path" ]] && echo -e "  ${DIM}$path${RESET}"
                        ;;
                    Write|write|StrReplace)
                        local path
                        path=$(echo "$line" | jq -r '.input.path // empty' 2>/dev/null)
                        [[ -n "$path" ]] && echo -e "  ${DIM}$path${RESET}"
                        ;;
                    Shell|Bash|shell|bash)
                        local cmd
                        cmd=$(echo "$line" | jq -r '.input.command // empty' 2>/dev/null | head -c 100)
                        [[ -n "$cmd" ]] && echo -e "  ${DIM}\$ $cmd${RESET}"
                        ;;
                    Grep|grep)
                        local pattern
                        pattern=$(echo "$line" | jq -r '.input.pattern // empty' 2>/dev/null)
                        [[ -n "$pattern" ]] && echo -e "  ${DIM}pattern: $pattern${RESET}"
                        ;;
                    Glob|glob)
                        local pattern
                        pattern=$(echo "$line" | jq -r '.input.glob_pattern // empty' 2>/dev/null)
                        [[ -n "$pattern" ]] && echo -e "  ${DIM}$pattern${RESET}"
                        ;;
                esac
                ;;
            "tool_result")
                echo -e "  ${DIM}✓${RESET}"
                ;;
            "result")
                echo ""
                echo -e "${GREEN}━━━ Iteration Complete${RESET}"
                ;;
        esac
    done
}

# Format plain text output (fallback for tools without structured JSON)
stream_format_plaintext() {
    local tmpfile=$1
    
    # Simple pass-through with basic formatting
    tee "$tmpfile" | while IFS= read -r line; do
        # Skip common noise patterns
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        [[ "$line" =~ ^\? ]] && continue
        [[ "$line" =~ ^❯ ]] && continue
        
        # Highlight common patterns
        if [[ "$line" =~ ^Thinking ]]; then
            echo -e "${DIM}$line${RESET}"
        elif [[ "$line" =~ (Error|error|ERROR) ]]; then
            echo -e "${RED}$line${RESET}"
        elif [[ "$line" =~ (Success|success|PASS|pass|✓) ]]; then
            echo -e "${GREEN}$line${RESET}"
        elif [[ "$line" =~ (Warning|warning|WARN) ]]; then
            echo -e "${YELLOW}$line${RESET}"
        else
            echo "$line"
        fi
    done
}

# Dispatcher for streaming output based on tool type
stream_format_output() {
    local tool=$1
    local tmpfile=$2
    
    case "$tool" in
        claude|cursor)
            stream_format_claude "$tmpfile"
            ;;
        droid)
            # Droid uses similar stream-json format
            stream_format_claude "$tmpfile"
            ;;
        opencode|codex|copilot|gemini|*)
            # Plain text fallback
            stream_format_plaintext "$tmpfile"
            ;;
    esac
}

# =============================================================================
# TASK FUNCTIONS (Dependency-Aware)
# =============================================================================

# Get the next ready task (all dependencies satisfied)
get_next_task() {
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo ""
        return
    fi

    # Get first task where:
    # - status is "pending"
    # - all dependsOn tasks have status "completed"
    jq -r '
      [.tasks[] | select(.status == "completed") | .id] as $completed |
      [.tasks[] | select(
        .status == "pending" and
        ((.dependsOn | length) == 0 or ((.dependsOn // []) - $completed | length) == 0)
      )] |
      sort_by(.phase, .priority) |
      .[0] // empty |
      "\(.id)|\(.title)|\(.phase)|\(.priority)"
    ' "$MANIFEST_FILE" 2>/dev/null || echo ""
}

# Get task by ID
get_task_by_id() {
    local task_id=$1
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo ""
        return
    fi

    jq -r --arg id "$task_id" '.tasks[] | select(.id == $id)' "$MANIFEST_FILE" 2>/dev/null || echo ""
}

# Get task description for prompt injection
get_task_description() {
    local task_id=$1
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo ""
        return
    fi

    jq -r --arg id "$task_id" '
      .tasks[] | select(.id == $id) |
      "**Task ID:** \(.id)\n**Title:** \(.title)\n**Phase:** \(.phase)\n**Priority:** \(.priority)\n**Size:** \(.size)\n\n**Description:**\n\(.description)"
    ' "$MANIFEST_FILE" 2>/dev/null || echo ""
}

# Mark task as completed
mark_task_complete() {
    local task_id=$1
    local tmp
    tmp=$(mktemp)

    jq --arg id "$task_id" '
      .tasks |= map(if .id == $id then .status = "completed" else . end)
    ' "$MANIFEST_FILE" > "$tmp" && mv "$tmp" "$MANIFEST_FILE"

    log_success "Task $task_id marked as completed"
}

# Mark task as blocked
mark_task_blocked() {
    local task_id=$1
    local reason=$2
    local tmp
    tmp=$(mktemp)

    jq --arg id "$task_id" --arg reason "$reason" '
      .tasks |= map(if .id == $id then .status = "blocked" | .blockedReason = $reason else . end)
    ' "$MANIFEST_FILE" > "$tmp" && mv "$tmp" "$MANIFEST_FILE"

    log_warn "Task $task_id marked as blocked: $reason"
}

# Get counts for status display
get_task_counts() {
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo "0|0|0|0"
        return
    fi

    jq -r '
      .tasks | {
        total: length,
        completed: map(select(.status == "completed")) | length,
        pending: map(select(.status == "pending")) | length,
        blocked: map(select(.status == "blocked")) | length
      } | "\(.total)|\(.completed)|\(.pending)|\(.blocked)"
    ' "$MANIFEST_FILE" 2>/dev/null || echo "0|0|0|0"
}

# Get count of ready tasks (pending with deps satisfied)
get_ready_count() {
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo "0"
        return
    fi

    jq -r '
      [.tasks[] | select(.status == "completed") | .id] as $completed |
      [.tasks[] | select(
        .status == "pending" and
        ((.dependsOn | length) == 0 or ((.dependsOn // []) - $completed | length) == 0)
      )] | length
    ' "$MANIFEST_FILE" 2>/dev/null || echo "0"
}

# Show task status summary
show_task_status() {
    local counts ready_count
    counts=$(get_task_counts)
    ready_count=$(get_ready_count)

    local total completed pending blocked
    total=$(echo "$counts" | cut -d'|' -f1)
    completed=$(echo "$counts" | cut -d'|' -f2)
    pending=$(echo "$counts" | cut -d'|' -f3)
    blocked=$(echo "$counts" | cut -d'|' -f4)

    local pct=0
    if [[ $total -gt 0 ]]; then
        pct=$((completed * 100 / total))
    fi

    echo ""
    printf "  ${BOLD}Progress:${RESET}   ${GREEN}%d${RESET}/%d tasks completed (${CYAN}%d%%${RESET})\n" "$completed" "$total" "$pct"
    printf "  ${BOLD}Ready:${RESET}      ${YELLOW}%d${RESET} tasks ready to work on\n" "$ready_count"
    printf "  ${BOLD}Pending:${RESET}    %d tasks waiting on dependencies\n" "$((pending - ready_count))"
    if [[ $blocked -gt 0 ]]; then
        printf "  ${BOLD}Blocked:${RESET}    ${RED}%d${RESET} tasks blocked\n" "$blocked"
    fi
    echo ""
}

# Show what task is being worked on
show_current_task() {
    local task_info
    task_info=$(get_next_task)

    if [ -n "$task_info" ] && [ "$task_info" != "|||" ]; then
        local task_id task_title task_phase task_priority
        task_id=$(echo "$task_info" | cut -d'|' -f1)
        task_title=$(echo "$task_info" | cut -d'|' -f2)
        task_phase=$(echo "$task_info" | cut -d'|' -f3)
        task_priority=$(echo "$task_info" | cut -d'|' -f4)

        show_task_status
        printf "  ${BOLD}Next Task:${RESET}  ${CYAN}%s${RESET} - %s\n" "$task_id" "$task_title"
        printf "  ${BOLD}Phase:${RESET}      %s │ ${BOLD}Priority:${RESET} %s\n" "$task_phase" "$task_priority"
        echo ""
    else
        show_task_status
        log_info "No ready tasks found. Check dependencies or if all tasks are complete."
    fi
}

# Legacy alias for backward compatibility
get_next_story() { get_next_task; }
get_remaining_count() { get_ready_count; }
show_current_story() { show_current_task; }

# =============================================================================
# CONTEXT INJECTION FUNCTIONS
# =============================================================================

# Get dependencies of a task
get_task_dependencies() {
    local task_id=$1
    if [ ! -f "$MANIFEST_FILE" ] || ! command -v jq &>/dev/null; then
        echo ""
        return
    fi

    jq -r --arg id "$task_id" '
      .tasks[] | select(.id == $id) | .dependsOn // [] | .[]
    ' "$MANIFEST_FILE" 2>/dev/null || echo ""
}

# Get last N entries from history
get_recent_history() {
    local count=${1:-3}
    if [ ! -f "$HISTORY_FILE" ]; then
        echo ""
        return
    fi

    tail -n "$count" "$HISTORY_FILE" 2>/dev/null || echo ""
}

# Get history entry for a specific task
get_task_history() {
    local task_id=$1
    if [ ! -f "$HISTORY_FILE" ]; then
        echo ""
        return
    fi

    grep "\"task\":\"$task_id\"" "$HISTORY_FILE" 2>/dev/null | tail -1 || echo ""
}

# Build context injection for prompt
build_context_injection() {
    local task_id=$1
    local context=""

    # Header
    context+="## Injected Context (from ralph.sh)\n\n"
    context+="> This context is auto-injected. You don't need to read history.jsonl.\n"
    context+="> DO read patterns.md for codebase patterns.\n\n"

    # Recent completions
    context+="### Recent Completions\n\n"
    local recent
    recent=$(get_recent_history 3)
    if [ -n "$recent" ]; then
        echo "$recent" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                local t_id t_title t_files
                t_id=$(echo "$line" | jq -r '.task // "?"')
                t_title=$(echo "$line" | jq -r '.title // "?"')
                t_files=$(echo "$line" | jq -r '.files // [] | join(", ")')
                context+="- **$t_id**: $t_title\n"
                if [ -n "$t_files" ] && [ "$t_files" != "" ]; then
                    context+="  - Files: $t_files\n"
                fi
            fi
        done
    else
        context+="(No tasks completed yet)\n"
    fi
    context+="\n"

    # Dependency context
    local deps
    deps=$(get_task_dependencies "$task_id")
    if [ -n "$deps" ]; then
        context+="### Your Task Depends On\n\n"
        for dep in $deps; do
            local dep_history
            dep_history=$(get_task_history "$dep")
            if [ -n "$dep_history" ]; then
                local dep_title dep_files dep_learnings
                dep_title=$(echo "$dep_history" | jq -r '.title // "?"')
                dep_files=$(echo "$dep_history" | jq -r '.files // [] | join(", ")')
                dep_learnings=$(echo "$dep_history" | jq -r '.learnings // [] | join("; ")')
                context+="**$dep** - $dep_title\n"
                if [ -n "$dep_files" ] && [ "$dep_files" != "" ]; then
                    context+="- Files touched: $dep_files\n"
                fi
                if [ -n "$dep_learnings" ] && [ "$dep_learnings" != "" ]; then
                    context+="- Key learnings: $dep_learnings\n"
                fi
                context+="\n"
            else
                context+="**$dep** - (completed, no history entry)\n\n"
            fi
        done
    fi

    context+="---\n"

    echo -e "$context"
}

# Append entry to history.jsonl (called after task completion)
append_history() {
    local task_id=$1
    local title=$2
    local files=$3      # comma-separated
    local learnings=$4  # comma-separated

    local files_json="[]"
    local learnings_json="[]"

    if [ -n "$files" ]; then
        files_json=$(echo "$files" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";""))')
    fi
    if [ -n "$learnings" ]; then
        learnings_json=$(echo "$learnings" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";""))')
    fi

    local entry
    entry=$(jq -n \
        --arg task "$task_id" \
        --arg title "$title" \
        --arg date "$(date -Iseconds)" \
        --argjson files "$files_json" \
        --argjson learnings "$learnings_json" \
        '{task: $task, title: $title, date: $date, files: $files, learnings: $learnings}')

    echo "$entry" >> "$HISTORY_FILE"
}

# =============================================================================
# RESILIENCE FUNCTIONS
# =============================================================================

# Track consecutive failures
consecutive_failures=0

# Retry a command with exponential backoff
retry_with_backoff() {
    local max_retries=$1
    local delay=$2
    shift 2
    local cmd=("$@")

    local attempt=1
    while [[ $attempt -le $max_retries ]]; do
        if "${cmd[@]}"; then
            return 0
        fi

        local exit_code=$?
        log_warn "Attempt $attempt/$max_retries failed (exit code: $exit_code)"

        if [[ $attempt -lt $max_retries ]]; then
            local wait_time=$((delay * attempt))  # Exponential backoff
            log_info "Waiting ${wait_time}s before retry..."
            sleep "$wait_time"
        fi

        ((attempt++))
    done

    return 1
}

# Check if error is rate limiting
is_rate_limited() {
    local output=$1
    if echo "$output" | grep -qiE "rate.?limit|too.?many.?requests|429|quota|throttl"; then
        return 0
    fi
    return 1
}

# Check if error is context overflow
is_context_overflow() {
    local output=$1
    if echo "$output" | grep -qiE "context.*(length|limit|overflow|exceed)|token.*(limit|exceed)|too.?long"; then
        return 0
    fi
    return 1
}

# Handle task failure
handle_task_failure() {
    local task_id=$1
    local output=$2
    local reason=$3

    ((consecutive_failures++))

    if is_rate_limited "$output"; then
        log_warn "Rate limited detected. Waiting ${RATE_LIMIT_WAIT}s..."
        sleep "$RATE_LIMIT_WAIT"
        consecutive_failures=0  # Don't count rate limits as failures
        return 1  # Signal to retry
    fi

    if is_context_overflow "$output"; then
        log_error "Context overflow on task $task_id"
        mark_task_blocked "$task_id" "Context overflow - task may be too large"
        return 0  # Continue to next task
    fi

    if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
        log_error "Max consecutive failures ($MAX_CONSECUTIVE_FAILURES) reached. Stopping."
        return 2  # Signal to stop
    fi

    log_warn "Task $task_id failed: $reason (consecutive failures: $consecutive_failures)"
    return 0  # Continue to next task
}

# Reset failure counter on success
handle_task_success() {
    consecutive_failures=0
}

# Save resume state
save_resume_state() {
    local iteration=$1
    local task_id=$2
    echo "{\"iteration\":$iteration,\"task\":\"$task_id\",\"timestamp\":\"$(date -Iseconds)\"}" > "$RALPH_DIR/.resume_state"
}

# Load resume state
load_resume_state() {
    if [[ -f "$RALPH_DIR/.resume_state" ]]; then
        cat "$RALPH_DIR/.resume_state"
    else
        echo ""
    fi
}

# Clear resume state
clear_resume_state() {
    rm -f "$RALPH_DIR/.resume_state"
}

# Run AI command with timeout
run_with_timeout() {
    local timeout_seconds=$1
    shift
    local cmd=("$@")

    # Use timeout command if available
    if command -v timeout &>/dev/null; then
        timeout --signal=TERM "$timeout_seconds" "${cmd[@]}"
        return $?
    fi

    # Fallback: manual timeout with background process
    "${cmd[@]}" &
    local pid=$!
    local elapsed=0

    while [[ $elapsed -lt $timeout_seconds ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            wait "$pid"
            return $?
        fi
        sleep 1
        ((elapsed++))
    done

    # Timeout reached - kill the process
    log_warn "Process timed out after ${timeout_seconds}s"
    kill -TERM "$pid" 2>/dev/null
    sleep 2
    kill -KILL "$pid" 2>/dev/null
    return 124  # Same exit code as GNU timeout
}

# =============================================================================
# DEFERRED STATUS MODE (needs functions defined above)
# =============================================================================

if [ "$SHOW_STATUS" = true ]; then
    if [ ! -f "$MANIFEST_FILE" ]; then
        log_error "Manifest file not found: $MANIFEST_FILE"
        exit 1
    fi
    print_header "Task Status"
    log_info "Manifest: $MANIFEST_FILE"
    show_task_status

    # Show next ready task
    next_task=$(get_next_task)
    if [ -n "$next_task" ] && [ "$next_task" != "|||" ]; then
        task_id=$(echo "$next_task" | cut -d'|' -f1)
        task_title=$(echo "$next_task" | cut -d'|' -f2)
        printf "  ${BOLD}Next Task:${RESET}  ${CYAN}%s${RESET} - %s\n\n" "$task_id" "$task_title"
    fi
    exit 0
fi

# Show detailed iteration summary
show_iteration_summary() {
    local log_file=$1
    local output=$2
    
    echo ""
    echo -e "  ${BOLD}━━━ Iteration Summary ━━━${RESET}"
    
    # Check if log file exists and has content
    if [ ! -f "$log_file" ] || [ ! -s "$log_file" ]; then
        echo -e "  ${RED}Error: No output captured from agent${RESET}"
        echo -e "  ${DIM}Check if the agent CLI is installed and accessible${RESET}"
        echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
        return
    fi
    
    # Check for errors in output
    if grep -q "Error:" "$log_file" 2>/dev/null; then
        echo -e "  ${RED}Agent Error:${RESET}"
        grep "Error:" "$log_file" | head -3 | while IFS= read -r line; do
            echo -e "    ${DIM}$line${RESET}"
        done
        echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
        return
    fi
    
    # Extract result from Claude output
    local result_line
    result_line=$(grep '"type":"result"' "$log_file" | tail -1)
    
    if [ -n "$result_line" ] && command -v jq &>/dev/null; then
        # Extract key fields
        local result_text duration_s num_turns actual_cost
        result_text=$(echo "$result_line" | jq -r '.result // "No result"' 2>/dev/null | head -10)
        duration_s=$(echo "$result_line" | jq -r '.duration_ms // 0' 2>/dev/null)
        duration_s=$((duration_s / 1000))
        num_turns=$(echo "$result_line" | jq -r '.num_turns // 0' 2>/dev/null)
        actual_cost=$(echo "$result_line" | jq -r '.total_cost_usd // 0' 2>/dev/null)
        
        # Extract token usage for context remaining calculation
        local input_tokens cache_read cache_creation output_toks
        input_tokens=$(echo "$result_line" | jq -r '.usage.input_tokens // 0' 2>/dev/null)
        cache_read=$(echo "$result_line" | jq -r '.usage.cache_read_input_tokens // 0' 2>/dev/null)
        cache_creation=$(echo "$result_line" | jq -r '.usage.cache_creation_input_tokens // 0' 2>/dev/null)
        output_toks=$(echo "$result_line" | jq -r '.usage.output_tokens // 0' 2>/dev/null)
        
        # Calculate total context used
        local total_context
        total_context=$((input_tokens + cache_read + cache_creation))
        
        # Show summary
        printf "  ${DIM}Duration:${RESET}  %dm %ds │ ${DIM}Turns:${RESET} %s │ ${DIM}Cost:${RESET} ${YELLOW}\$%.2f${RESET}\n" \
            $((duration_s / 60)) $((duration_s % 60)) "$num_turns" "$actual_cost"
        printf "  ${DIM}Context:${RESET}   %s tokens used │ ${DIM}Output:${RESET} %s tokens\n" \
            "$(format_tokens $total_context)" "$(format_tokens $output_toks)"
        
        echo ""
        echo -e "  ${BOLD}Result:${RESET}"
        echo "$result_text" | while IFS= read -r line; do
            printf "    %s\n" "$line"
        done
    else
        echo -e "  ${DIM}(No structured result available - check log file)${RESET}"
        echo -e "  ${DIM}Log: $log_file${RESET}"
    fi
    
    echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

# =============================================================================
# BROWSER AUTOMATION
# =============================================================================

get_browser_instructions() {
    # Check if enabled
    if [ "$BROWSER_ENABLED" = "false" ]; then return; fi
    
    # Check if tool exists
    if ! command -v agent-browser &>/dev/null; then
        if [ "$BROWSER_ENABLED" = "true" ]; then
             log_warn "Browser enabled but agent-browser not found."
        fi
        return
    fi
    
    cat << 'EOF'

## Browser Automation
You have access to a browser via `agent-browser`.
- `agent-browser open <url>`
- `agent-browser click @e1`
- `agent-browser type @e1 "text"`
- `agent-browser screenshot`
Use this for visual verification or web interactions.
EOF
}

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

deps=("jq")
optional_deps=("bc")

for cmd in "${deps[@]}"; do
    if ! command_exists "$cmd"; then
        log_warn "Missing required dependency: $cmd (some features may be limited)"
    fi
done

for cmd in "${optional_deps[@]}"; do
    if ! command_exists "$cmd"; then
        log_info "Optional dependency not found: $cmd (using fallback)"
    fi
done

# =============================================================================
# SETUP
# =============================================================================

RUN_DATE=$(date +%Y-%m-%d)
RUN_TIMESTAMP=$(date +%s)
LOG_DIR="$LOGS_BASE_DIR/$RUN_DATE-run-$RUN_TIMESTAMP"
mkdir -p "$LOG_DIR"

log_info "Ralph Starting... Tool: ${BOLD}$TOOL${RESET} - Max iterations: ${BOLD}$MAX_ITERATIONS${RESET}"
log_info "Logging session to: $LOG_DIR"

# Archive logic (Modified to be safer)
if [ -f "$MANIFEST_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branch // empty' "$MANIFEST_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    print_header "Archiving Previous Context"
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||' | sed 's|^feature/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$RUN_DATE-$FOLDER_NAME"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$MANIFEST_FILE" ] && cp "$MANIFEST_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    log_success "Archived to: $ARCHIVE_FOLDER"

    # Reset progress
    FEATURE_NAME=$(jq -r '.feature // "Unknown"' "$MANIFEST_FILE" 2>/dev/null || echo "Unknown")
    cat > "$PROGRESS_FILE" << EOF
# Ralph Progress Log

Feature: $FEATURE_NAME
Branch: $CURRENT_BRANCH
Started: $(date)

## Codebase Patterns

(Add reusable patterns discovered during implementation here)

---

EOF
  fi
fi

if [ -f "$MANIFEST_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branch // empty' "$MANIFEST_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"; fi
fi

# Ensure ralph directory exists
mkdir -p "$RALPH_DIR"

if [ ! -f "$PROGRESS_FILE" ]; then
  FEATURE_NAME=$(jq -r '.feature // "Unknown"' "$MANIFEST_FILE" 2>/dev/null || echo "Unknown")
  BRANCH_NAME=$(jq -r '.branch // "unknown"' "$MANIFEST_FILE" 2>/dev/null || echo "unknown")
  cat > "$PROGRESS_FILE" << EOF
# Ralph Progress Log

Feature: $FEATURE_NAME
Branch: $BRANCH_NAME
Started: $(date)

## Codebase Patterns

(Add reusable patterns discovered during implementation here)

---

EOF
fi

# =============================================================================
# MAIN LOOP
# =============================================================================

# Validate manifest file exists
if [ ! -f "$MANIFEST_FILE" ]; then
    log_error "Manifest file not found: $MANIFEST_FILE"
    log_info "Create one with: ./ralph.sh --init or create ralph/manifest.json manually"
    exit 1
fi

log_info "Manifest: $MANIFEST_FILE"

# Dry-run mode: show what would be run and exit
if [ "$DRY_RUN" = true ]; then
    print_header "Dry Run Mode"
    log_info "Tool: $TOOL"
    log_info "Max iterations: $MAX_ITERATIONS"
    log_info "Manifest file: $MANIFEST_FILE"
    log_info "Progress file: $PROGRESS_FILE"
    log_info "Prompt file: $PROMPT_FILE"
    log_info "Log directory: $LOG_DIR"
    log_info "Config file: ${CONFIG_FILE:-none}"
    [[ -n "${PROJECT_LANG:-}" ]] && log_info "Project: $PROJECT_LANG ${PROJECT_FRAMEWORK:-}"
    [[ -n "$MODEL_OVERRIDE" ]] && log_info "Model override: $MODEL_OVERRIDE"
    log_info "Browser: $BROWSER_ENABLED"
    log_info "Stream: $STREAM"
    log_info "Verbose: $VERBOSE"

    # Show task status and next task
    show_current_task

    log_success "Dry run complete. No AI iterations executed."
    exit 0
fi

SESSION_START=$(date +%s)
START_ITERATION=1

# Handle resume mode
if [ "$RESUME_MODE" = true ]; then
    RESUME_STATE=$(load_resume_state)
    if [ -n "$RESUME_STATE" ]; then
        last_iteration=$(echo "$RESUME_STATE" | jq -r '.iteration // 1')
        last_task=$(echo "$RESUME_STATE" | jq -r '.task // "unknown"')
        last_time=$(echo "$RESUME_STATE" | jq -r '.timestamp // "unknown"')

        log_info "Resume state found:"
        log_info "  Last iteration: $last_iteration"
        log_info "  Last task: $last_task"
        log_info "  Time: $last_time"

        # Start from the next iteration
        START_ITERATION=$((last_iteration + 1))

        if [[ $START_ITERATION -gt $MAX_ITERATIONS ]]; then
            log_warn "Resume would exceed max iterations. Starting fresh."
            START_ITERATION=1
            clear_resume_state
        else
            log_info "Resuming from iteration $START_ITERATION"
        fi
    else
        log_info "No resume state found. Starting fresh."
    fi
fi

for i in $(seq $START_ITERATION $MAX_ITERATIONS); do
  print_header "Iteration $i of $MAX_ITERATIONS"
  
  # Show what story will be worked on
  show_current_story
  
  ITERATION_LOG="$LOG_DIR/${i}_iteration.log"
  current_step="Thinking"

  # Get the next task to work on
  TASK_INFO=$(get_next_task)
  if [ -z "$TASK_INFO" ] || [ "$TASK_INFO" == "|||" ]; then
    log_warn "No ready tasks found for iteration $i"
    continue
  fi

  CURRENT_TASK_ID=$(echo "$TASK_INFO" | cut -d'|' -f1)
  CURRENT_TASK_TITLE=$(echo "$TASK_INFO" | cut -d'|' -f2)

  # Build Prompt
  FULL_PROMPT_FILE="$LOG_DIR/${i}_prompt_full.md"
  cp "$PROMPT_FILE" "$FULL_PROMPT_FILE"

  # Build context injection (recent history + dependency context)
  CONTEXT_INJECTION=$(build_context_injection "$CURRENT_TASK_ID")

  # Inject task details at the injection point
  TASK_DETAILS=$(get_task_description "$CURRENT_TASK_ID")

  # Combine context + task details
  FULL_INJECTION="${CONTEXT_INJECTION}\n\n## Assigned Task\n\n${TASK_DETAILS}"

  # Replace the injection point comment with context + task details
  # Use a robust method that handles special characters
  if grep -qn "<!-- TASK_INJECTION_POINT -->" "$FULL_PROMPT_FILE"; then
    INJECT_LINE=$(grep -n "<!-- TASK_INJECTION_POINT -->" "$FULL_PROMPT_FILE" | head -1 | cut -d: -f1)
    {
      head -n $((INJECT_LINE - 1)) "$FULL_PROMPT_FILE"
      echo -e "$FULL_INJECTION"
      tail -n +$((INJECT_LINE + 1)) "$FULL_PROMPT_FILE"
    } > "$FULL_PROMPT_FILE.new" && mv "$FULL_PROMPT_FILE.new" "$FULL_PROMPT_FILE"
  else
    # Fallback: append at the end
    echo -e "\n$FULL_INJECTION" >> "$FULL_PROMPT_FILE"
  fi

  # Append file locations
  MANIFEST_RELATIVE=$(realpath --relative-to="$SCRIPT_DIR" "$MANIFEST_FILE" 2>/dev/null || basename "$MANIFEST_FILE")
  PATTERNS_RELATIVE=$(realpath --relative-to="$SCRIPT_DIR" "$PATTERNS_FILE" 2>/dev/null || basename "$PATTERNS_FILE")
  echo -e "\n## File Locations\n- Manifest: \`$MANIFEST_RELATIVE\`\n- Patterns: \`$PATTERNS_RELATIVE\` (READ THIS for codebase patterns)" >> "$FULL_PROMPT_FILE"
  
  # Append Browser Instructions
  get_browser_instructions >> "$FULL_PROMPT_FILE"
  
  # Append Project Context if in config
  if [ -n "${PROJECT_LANG:-}" ]; then
      echo -e "\n## Project Context" >> "$FULL_PROMPT_FILE"
      echo "Language: $PROJECT_LANG" >> "$FULL_PROMPT_FILE"
      if [ -n "${PROJECT_FRAMEWORK:-}" ]; then echo "Framework: $PROJECT_FRAMEWORK" >> "$FULL_PROMPT_FILE"; fi
      if [ -n "${TEST_COMMAND:-}" ]; then echo "Test Command: $TEST_COMMAND" >> "$FULL_PROMPT_FILE"; fi
  fi

  # Create temp file for output
  tmpfile=$(mktemp)
  
  # Run the selected tool in background
  PROMPT_CONTENT=$(cat "$FULL_PROMPT_FILE")
  
  # Write prompt to temp file (avoids shell escaping issues)
  PROMPT_TMP="$LOG_DIR/${i}_prompt_input.txt"
  echo "$PROMPT_CONTENT" > "$PROMPT_TMP"

  case "$TOOL" in
    claude)
         # Note: --verbose is required when using -p with --output-format stream-json
         CMD="claude --dangerously-skip-permissions --output-format stream-json --verbose"
         if [ -n "$MODEL_OVERRIDE" ]; then CMD="$CMD --model $MODEL_OVERRIDE"; fi

         if [ "$STREAM" = true ]; then
             echo -e "  ${DIM}[Streaming - tool calls]${RESET}"
             echo ""
             # Run with timeout, tee to file, filter and display with perl (unbuffered)
             timeout "$TASK_TIMEOUT" bash -c "$CMD -p \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile" | perl -ne '
                 BEGIN { $| = 1; }  # unbuffered output
                 if (/"type":"tool_use".*"name":"([^"]+)"/) {
                     print "\e[33m▶ $1\e[0m\n";
                 } elsif (/"name":"([^"]+)".*"type":"tool_use"/) {
                     print "\e[33m▶ $1\e[0m\n";
                 } elsif (/"type":"result"/) {
                     print "\e[32m✓ Iteration Complete\e[0m\n";
                 }
             '
             AI_EXIT_CODE=${PIPESTATUS[0]}
         elif [ "$VERBOSE" = true ]; then
             echo -e "  ${DIM}[Verbose mode - raw JSON output]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "$CMD -p \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "$CMD -p \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    cursor)
         CMD="agent --output-format stream-json"
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "$CMD -p \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "$CMD -p \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    opencode)
         CMD="opencode run --format json ${MODEL_OVERRIDE:+--model "$MODEL_OVERRIDE"}"
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "OPENCODE_PERMISSION='{\"*\":\"allow\"}' $CMD \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "OPENCODE_PERMISSION='{\"*\":\"allow\"}' $CMD \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    codex)
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "codex exec --full-auto --json \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "codex exec --full-auto --json \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    droid)
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "droid exec --output-format stream-json --auto medium \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "droid exec --output-format stream-json --auto medium \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    copilot)
         CMD="copilot -p"
         if [ -n "$MODEL_OVERRIDE" ]; then CMD="$CMD --model $MODEL_OVERRIDE"; fi
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "$CMD \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "$CMD \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    gemini)
         if command -v gemini &>/dev/null; then
             GEMINI_CMD="gemini run"
         elif command -v npx &>/dev/null; then
             GEMINI_CMD="npx -y @google/gemini-cli run"
         else
             log_error "Neither 'gemini' CLI nor 'npx' found."
             exit 1
         fi
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             timeout "$TASK_TIMEOUT" bash -c "$GEMINI_CMD \"\$(cat '$PROMPT_TMP')\" 2>&1" | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             timeout "$TASK_TIMEOUT" bash -c "$GEMINI_CMD \"\$(cat '$PROMPT_TMP')\" > '$tmpfile' 2>&1"
             AI_EXIT_CODE=$?
         fi
         ;;
    dummy)
         dummy_output() {
           echo '{"type":"assistant","message":{"content":[{"type":"text","text":"I will start working on the task..."}]}}'
           sleep 1
           echo '{"type":"tool_use","name":"Read","input":{"path":"prd.json"}}'
           sleep 1
           echo '{"type":"tool_result","content":"File contents..."}'
           sleep 1
           echo '{"type":"tool_use","name":"Shell","input":{"command":"npm run test"}}'
           sleep 1
           echo '{"type":"tool_result","content":"All tests passed"}'
           if (( RANDOM % 3 == 0 )); then
              echo '{"type":"result","result":"Task completed","usage":{"input_tokens":1500,"output_tokens":500}}'
              echo "<task-complete>P1-001</task-complete>"
           else
              echo '{"type":"result","result":"Working on task...","usage":{"input_tokens":1200,"output_tokens":400}}'
           fi
         }
         if [ "$STREAM" = true ] || [ "$VERBOSE" = true ]; then
             [[ "$STREAM" = true ]] && echo -e "  ${DIM}[Streaming mode]${RESET}" || echo -e "  ${DIM}[Verbose mode]${RESET}"
             echo ""
             dummy_output 2>&1 | tee "$tmpfile"
             AI_EXIT_CODE=$?
         else
             dummy_output > "$tmpfile" 2>&1
             AI_EXIT_CODE=$?
         fi
         ;;
    *)
         log_error "Unknown tool: $TOOL"
         exit 1
         ;;
  esac

  # Save resume state
  save_resume_state "$i" "$CURRENT_TASK_ID"

  # Check for timeout (exit code 124)
  TIMEOUT_REACHED=false
  if [[ $AI_EXIT_CODE -eq 124 ]]; then
      TIMEOUT_REACHED=true
  fi

  # Read and save result
  OUTPUT=$(cat "$tmpfile" 2>/dev/null || echo "")

  # Check for timeout
  if [[ "$TIMEOUT_REACHED" == "true" ]]; then
      log_warn "Task $CURRENT_TASK_ID timed out after ${TASK_TIMEOUT}s"
      mark_task_blocked "$CURRENT_TASK_ID" "Timed out - task may be too complex or stuck"
      ((consecutive_failures++))

      if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
          log_error "Max consecutive failures ($MAX_CONSECUTIVE_FAILURES) reached."
          SESSION_END=$(date +%s)
          SESSION_DURATION=$((SESSION_END - SESSION_START))
          print_session_summary "$SESSION_DURATION" "$i"
          exit 1
      fi

      log_info "Skipping to next task..."
      continue
  fi

  # Check for AI execution failure
  if [[ -z "$OUTPUT" ]] || [[ $AI_EXIT_CODE -ne 0 ]]; then
      log_warn "AI execution failed or returned empty output (exit code: $AI_EXIT_CODE)"

      # Handle the failure
      handle_task_failure "$CURRENT_TASK_ID" "$OUTPUT" "AI execution failed"
      failure_code=$?

      if [[ $failure_code -eq 1 ]]; then
          # Retry this iteration (rate limit)
          log_info "Retrying iteration $i..."
          continue
      elif [[ $failure_code -eq 2 ]]; then
          # Max failures reached, stop
          SESSION_END=$(date +%s)
          SESSION_DURATION=$((SESSION_END - SESSION_START))
          print_session_summary "$SESSION_DURATION" "$i"
          exit 1
      fi

      # Continue to next task
      log_info "Skipping to next task..."
      continue
  fi
  cp "$tmpfile" "$ITERATION_LOG" 2>/dev/null || true
  
  # Parse tokens and cost
  parsed=$(parse_ai_result "$OUTPUT")
  response=$(echo "$parsed" | sed '/^---TOKENS---$/,$d')
  token_data=$(echo "$parsed" | sed -n '/^---TOKENS---$/,$p' | tail -3)
  input_tokens=$(echo "$token_data" | sed -n '1p')
  output_tokens=$(echo "$token_data" | sed -n '2p')
  actual_cost=$(echo "$token_data" | sed -n '3p')
  
  # Sanitize values
  [[ "$input_tokens" =~ ^[0-9]+$ ]] || input_tokens=0
  [[ "$output_tokens" =~ ^[0-9]+$ ]] || output_tokens=0
  
  # Update totals
  total_input_tokens=$((total_input_tokens + input_tokens))
  total_output_tokens=$((total_output_tokens + output_tokens))
  
  # Track actual cost or duration
  if [[ -n "$actual_cost" ]]; then
    if [[ "$actual_cost" == duration:* ]]; then
      dur_ms="${actual_cost#duration:}"
      [[ "$dur_ms" =~ ^[0-9]+$ ]] && total_duration_ms=$((total_duration_ms + dur_ms))
    elif [[ "$actual_cost" != "0" ]] && command -v bc &>/dev/null; then
      total_cost=$(echo "scale=6; $total_cost + $actual_cost" | bc 2>/dev/null || echo "$total_cost")
    fi
  fi
  
  # Calculate iteration cost if we have tokens
  iter_cost="N/A"
  if [[ $input_tokens -gt 0 ]] || [[ $output_tokens -gt 0 ]]; then
    iter_cost=$(calculate_cost "$input_tokens" "$output_tokens")
  fi
  
  # Display basic completion
  printf "  ${GREEN}✓${RESET} %-16s │ " "Done"
  if [[ $input_tokens -gt 0 ]] || [[ $output_tokens -gt 0 ]]; then
    printf "Tokens: ${CYAN}%s${RESET} in / ${CYAN}%s${RESET} out" "$(format_tokens $input_tokens)" "$(format_tokens $output_tokens)"
    if [[ "$iter_cost" != "N/A" ]]; then
      printf " │ Cost: ${YELLOW}\$%s${RESET}" "$iter_cost"
    fi
  else
    printf "Iteration complete"
  fi
  printf "\n"
  
  # Show detailed iteration summary
  show_iteration_summary "$ITERATION_LOG" "$OUTPUT"
  
  # Cleanup temp file
  rm -f "$tmpfile"
  tmpfile=""
  
  # Check for task completion marker FIRST (before error checks)
  TASK_COMPLETED=false
  if echo "$OUTPUT" | grep -qF "$TASK_COMPLETE_PATTERN"; then
    completed_task_id=$(echo "$OUTPUT" | grep -oP '(?<=<task-complete>)[^<]+(?=</task-complete>)' | head -1)

    if [ -n "$completed_task_id" ]; then
        mark_task_complete "$completed_task_id"
        handle_task_success
        TASK_COMPLETED=true
        log_success "Task $completed_task_id completed successfully"
    fi
  fi

  # Only check for errors if task didn't complete successfully
  if [[ "$TASK_COMPLETED" != "true" ]]; then
      if is_rate_limited "$OUTPUT"; then
          log_warn "Rate limit detected in output. Waiting ${RATE_LIMIT_WAIT}s..."
          sleep "$RATE_LIMIT_WAIT"
          log_info "Retrying iteration $i..."
          continue
      fi

      if is_context_overflow "$OUTPUT"; then
          log_error "Context overflow detected for task $CURRENT_TASK_ID"
          mark_task_blocked "$CURRENT_TASK_ID" "Context overflow - task may be too large"
          log_info "Continuing to next task..."
          continue
      fi
  fi

  # If no completion marker, check if task was blocked
  if [[ "$TASK_COMPLETED" != "true" ]]; then
      # Check for task blocked marker
      if echo "$OUTPUT" | grep -qF "$TASK_BLOCKED_PATTERN"; then
          blocked_info=$(echo "$OUTPUT" | grep -oP '(?<=<task-blocked>)[^<]+(?=</task-blocked>)' | head -1)
          if [ -n "$blocked_info" ]; then
              blocked_id=$(echo "$blocked_info" | cut -d':' -f1)
              blocked_reason=$(echo "$blocked_info" | cut -d':' -f2-)
              mark_task_blocked "$blocked_id" "$blocked_reason"
          fi
      else
          # No completion or blocked marker - task didn't finish properly
          log_warn "Task $CURRENT_TASK_ID did not signal completion"
          ((consecutive_failures++))

          if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
              log_error "Max consecutive failures ($MAX_CONSECUTIVE_FAILURES) reached."
              SESSION_END=$(date +%s)
              SESSION_DURATION=$((SESSION_END - SESSION_START))
              print_session_summary "$SESSION_DURATION" "$i"
              exit 1
          fi
      fi
  fi

  # Check if all tasks are complete
  ready_count=$(get_ready_count)
  counts=$(get_task_counts)
  total=$(echo "$counts" | cut -d'|' -f1)
  completed=$(echo "$counts" | cut -d'|' -f2)

  if [[ "$completed" -eq "$total" ]] || echo "$OUTPUT" | grep -qF "$ALL_COMPLETE_MARKER"; then
    print_header "Mission Accomplished"
    log_success "Ralph completed all $total tasks at iteration $i!"
    show_task_status

    # Clear resume state on successful completion
    clear_resume_state

    SESSION_END=$(date +%s)
    SESSION_DURATION=$((SESSION_END - SESSION_START))
    print_session_summary "$SESSION_DURATION" "$i"
    exit 0
  fi

  # Check if no more ready tasks (all blocked or waiting)
  if [[ "$ready_count" -eq 0 ]]; then
    print_header "No Ready Tasks"
    log_warn "All remaining tasks are blocked or waiting on dependencies."
    show_task_status

    SESSION_END=$(date +%s)
    SESSION_DURATION=$((SESSION_END - SESSION_START))
    print_session_summary "$SESSION_DURATION" "$i"
    exit 1
  fi
  
  log_info "Continuing to next iteration..."
  sleep 2
done

# Show session summary on max iterations
SESSION_END=$(date +%s)
SESSION_DURATION=$((SESSION_END - SESSION_START))

print_header "Max Iterations Reached"
log_warn "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
print_session_summary "$SESSION_DURATION" "$MAX_ITERATIONS"
exit 1

