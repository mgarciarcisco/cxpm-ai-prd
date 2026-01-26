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
${BOLD}Ralph Wiggum${RESET} - Long-running AI agent loop

${BOLD}Usage:${RESET} ./ralph.sh [options] [max_iterations]

${BOLD}Options:${RESET}
  --init              Initialize Ralph config for current project
  --config            Show current configuration
  --prd <file>        Use specified PRD file (default: prd.json)
  --tool <name>       Use specified AI tool (claude, cursor, opencode, codex, droid, copilot, gemini)
  --cursor            Shorthand for --tool cursor
  --opencode          Shorthand for --tool opencode
  --codex             Shorthand for --tool codex
  --droid             Shorthand for --tool droid
  --copilot           Shorthand for --tool copilot
  --model <name>      Override model selection
  --browser           Enable browser automation
  --no-browser        Disable browser automation
  --dry-run           Preview actions without executing AI
  --help, -h          Show this help message

${BOLD}Examples:${RESET}
  ./ralph.sh 5                            Run 5 iterations with default tool
  ./ralph.sh --cursor 10                  Run 10 iterations using Cursor
  ./ralph.sh --prd docs/my-prd.json 5     Use custom PRD file
  ./ralph.sh --dry-run                    Preview without running

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
PRD_FILE="${PRD_FILE:-$SCRIPT_DIR/prd.json}"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LOGS_BASE_DIR="$SCRIPT_DIR/logs"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
PROMPT_FILE="${PROMPT_FILE:-$SCRIPT_DIR/prompt.md}"

# Defaults
TOOL="claude"
MAX_ITERATIONS=10
BROWSER_ENABLED="auto"
MODEL_OVERRIDE=""
INIT_MODE=false
SHOW_CONFIG=false
DRY_RUN=false

# Configurable pricing (per million tokens) - can be overridden in .ralphrc
INPUT_PRICE_PER_M="${INPUT_PRICE_PER_M:-3}"
OUTPUT_PRICE_PER_M="${OUTPUT_PRICE_PER_M:-15}"

# Configurable completion marker
COMPLETION_MARKER="${COMPLETION_MARKER:-<promise>COMPLETE</promise>}"

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
    --model)
      MODEL_OVERRIDE="$2"
      shift 2
      ;;
    --prd)
      PRD_FILE="$2"
      # Convert relative path to absolute
      if [[ ! "$PRD_FILE" = /* ]]; then
        PRD_FILE="$SCRIPT_DIR/$PRD_FILE"
      fi
      shift 2
      ;;
    --prd=*)
      PRD_FILE="${1#*=}"
      # Convert relative path to absolute
      if [[ ! "$PRD_FILE" = /* ]]; then
        PRD_FILE="$SCRIPT_DIR/$PRD_FILE"
      fi
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
        log_warn "Interrupted! Cleaned up."
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
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    print_header "Archiving Previous Context"
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$RUN_DATE-$FOLDER_NAME"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    log_success "Archived to: $ARCHIVE_FOLDER"
    
    # Reset progress
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"; fi
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# =============================================================================
# MAIN LOOP
# =============================================================================

# Validate PRD file exists
if [ ! -f "$PRD_FILE" ]; then
    log_error "PRD file not found: $PRD_FILE"
    exit 1
fi

log_info "PRD file: $PRD_FILE"

# Dry-run mode: show what would be run and exit
if [ "$DRY_RUN" = true ]; then
    print_header "Dry Run Mode"
    log_info "Tool: $TOOL"
    log_info "Max iterations: $MAX_ITERATIONS"
    log_info "PRD file: $PRD_FILE"
    log_info "Prompt file: $PROMPT_FILE"
    log_info "Log directory: $LOG_DIR"
    log_info "Config file: ${CONFIG_FILE:-none}"
    [[ -n "${PROJECT_LANG:-}" ]] && log_info "Project: $PROJECT_LANG ${PROJECT_FRAMEWORK:-}"
    [[ -n "$MODEL_OVERRIDE" ]] && log_info "Model override: $MODEL_OVERRIDE"
    log_info "Browser: $BROWSER_ENABLED"
    echo ""
    log_success "Dry run complete. No AI iterations executed."
    exit 0
fi

SESSION_START=$(date +%s)

for i in $(seq 1 $MAX_ITERATIONS); do
  print_header "Iteration $i of $MAX_ITERATIONS"
  ITERATION_LOG="$LOG_DIR/${i}_iteration.log"
  current_step="Thinking"

  # Build Prompt
  FULL_PROMPT_FILE="$LOG_DIR/${i}_prompt_full.md"
  cp "$PROMPT_FILE" "$FULL_PROMPT_FILE"
  
  # Append Browser Instructions
  get_browser_instructions >> "$FULL_PROMPT_FILE"
  
  # Append Project Context if in config
  if [ -n "$PROJECT_LANG" ]; then
      echo -e "\n## Project Context" >> "$FULL_PROMPT_FILE"
      echo "Language: $PROJECT_LANG" >> "$FULL_PROMPT_FILE"
      if [ -n "$PROJECT_FRAMEWORK" ]; then echo "Framework: $PROJECT_FRAMEWORK" >> "$FULL_PROMPT_FILE"; fi
      if [ -n "$TEST_COMMAND" ]; then echo "Test Command: $TEST_COMMAND" >> "$FULL_PROMPT_FILE"; fi
  fi

  # Create temp file for output
  tmpfile=$(mktemp)
  
  # Run the selected tool in background
  PROMPT_CONTENT=$(cat "$FULL_PROMPT_FILE")
  
  case "$TOOL" in
    claude)
         CMD="claude --dangerously-skip-permissions --output-format stream-json"
         if [ -n "$MODEL_OVERRIDE" ]; then CMD="$CMD --model $MODEL_OVERRIDE"; fi
         $CMD -p "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    cursor)
         CMD="agent --dangerously-skip-permissions --output-format stream-json"
         $CMD -p "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    opencode)
         OPENCODE_PERMISSION='{"*":"allow"}' opencode run --format json ${MODEL_OVERRIDE:+--model "$MODEL_OVERRIDE"} "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    codex)
         codex exec --full-auto --json "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    droid)
         droid exec --output-format stream-json --auto medium "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    copilot)
         CMD="copilot -p"
         if [ -n "$MODEL_OVERRIDE" ]; then CMD="$CMD --model $MODEL_OVERRIDE"; fi
         $CMD "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    gemini)
         if command -v gemini &>/dev/null; then
             gemini run "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         elif command -v npx &>/dev/null; then
             npx -y @google/gemini-cli run "$PROMPT_CONTENT" > "$tmpfile" 2>&1 &
         else
             log_error "Neither 'gemini' CLI nor 'npx' found."
             exit 1
         fi
         ai_pid=$!
         ;;
    dummy)
         (
           echo "[DUMMY] Reading prompt from $FULL_PROMPT_FILE..."
           sleep 3
           if (( RANDOM % 3 == 0 )); then
              echo '{"type":"result","result":"Task completed","usage":{"input_tokens":1500,"output_tokens":500}}'
              echo "<promise>COMPLETE</promise>"
           else
              echo '{"type":"result","result":"Working on task...","usage":{"input_tokens":1200,"output_tokens":400}}'
           fi
         ) > "$tmpfile" 2>&1 &
         ai_pid=$!
         ;;
    *)
         log_error "Unknown tool: $TOOL"
         exit 1
         ;;
  esac
  
  # Start progress monitor in background
  monitor_progress "$tmpfile" "Iteration $i" &
  monitor_pid=$!
  
  # Wait for AI to finish
  wait "$ai_pid" 2>/dev/null || true
  
  # Stop the monitor
  kill "$monitor_pid" 2>/dev/null || true
  wait "$monitor_pid" 2>/dev/null || true
  monitor_pid=""
  
  # Clear the progress line
  printf "\r\033[K"
  
  # Read and save result
  OUTPUT=$(cat "$tmpfile" 2>/dev/null || echo "")
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
  
  # Display iteration summary
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
  
  # Cleanup temp file
  rm -f "$tmpfile"
  tmpfile=""
  
  # Check for completion
  if echo "$OUTPUT" | grep -qF "$COMPLETION_MARKER"; then
    print_header "Mission Accomplished"
    log_success "Ralph completed all tasks at iteration $i!"
    
    SESSION_END=$(date +%s)
    SESSION_DURATION=$((SESSION_END - SESSION_START))
    print_session_summary "$SESSION_DURATION" "$i"
    exit 0
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

