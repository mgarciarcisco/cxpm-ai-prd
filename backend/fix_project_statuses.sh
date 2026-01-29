#!/bin/bash
# Fix project stage statuses to show different progress levels

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="$BASE_URL/api/projects"

echo ""
echo "🔧 Updating project stage statuses..."
echo ""

# Get project IDs
CHATBOT_ID=$(curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("AI Customer Support")) | .id')
BANKING_ID=$(curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("Mobile Banking")) | .id')
ONBOARDING_ID=$(curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("Employee Onboarding")) | .id')
INVENTORY_ID=$(curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("Inventory Management")) | .id')
LEGACY_ID=$(curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("Legacy CRM")) | .id')

update_stage() {
    local project_id="$1"
    local stage="$2"
    local status="$3"

    curl -s -X PATCH "$API_URL/$project_id/stages/$stage" \
        -H "Content-Type: application/json" \
        -d "{\"status\": \"$status\"}" > /dev/null
}

echo "Updating AI Customer Support Chatbot to COMPLETE status..."
if [ -n "$CHATBOT_ID" ] && [ "$CHATBOT_ID" != "null" ]; then
    update_stage "$CHATBOT_ID" "requirements" "reviewed"
    update_stage "$CHATBOT_ID" "prd" "ready"
    update_stage "$CHATBOT_ID" "stories" "refined"
    update_stage "$CHATBOT_ID" "mockups" "generated"
    update_stage "$CHATBOT_ID" "export" "exported"
    echo "  ✓ Updated"
else
    echo "  ✗ Project not found"
fi

echo "Updating Mobile Banking to STORIES stage..."
if [ -n "$BANKING_ID" ] && [ "$BANKING_ID" != "null" ]; then
    update_stage "$BANKING_ID" "requirements" "reviewed"
    update_stage "$BANKING_ID" "prd" "ready"
    update_stage "$BANKING_ID" "stories" "generated"
    echo "  ✓ Updated"
else
    echo "  ✗ Project not found"
fi

echo "Updating Employee Onboarding to PRD stage..."
if [ -n "$ONBOARDING_ID" ] && [ "$ONBOARDING_ID" != "null" ]; then
    update_stage "$ONBOARDING_ID" "requirements" "reviewed"
    update_stage "$ONBOARDING_ID" "prd" "draft"
    echo "  ✓ Updated"
else
    echo "  ✗ Project not found"
fi

echo "Updating Inventory Management to REQUIREMENTS stage..."
if [ -n "$INVENTORY_ID" ] && [ "$INVENTORY_ID" != "null" ]; then
    update_stage "$INVENTORY_ID" "requirements" "has_items"
    echo "  ✓ Updated"
else
    echo "  ✗ Project not found"
fi

echo "Archiving Legacy CRM project..."
if [ -n "$LEGACY_ID" ] && [ "$LEGACY_ID" != "null" ]; then
    curl -s -X PUT "$API_URL/$LEGACY_ID" \
        -H "Content-Type: application/json" \
        -d '{"archived": true}' > /dev/null
    echo "  ✓ Archived"
else
    echo "  ✗ Project not found"
fi

echo ""
echo "✅ Project statuses updated!"
echo ""
echo "Verifying project states:"
curl -s "$BASE_URL/api/projects" | jq -r '.[] | select(.name | contains("AI Customer") or contains("Mobile Banking") or contains("Employee") or contains("Inventory") or contains("Legacy")) | "  \(.name): \(.requirements_status)/\(.prd_status)/\(.stories_status)/\(.mockups_status)/\(.export_status) (archived: \(.archived))"'
echo ""
