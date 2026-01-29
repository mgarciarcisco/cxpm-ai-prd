#!/bin/bash
# Seed user stories for demo projects

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="$BASE_URL/api"

echo ""
echo "🌱 Seeding user stories..."
echo ""

# Get project IDs
CHATBOT_ID=$(curl -s "$API_URL/projects" | jq -r '.[] | select(.name | contains("AI Customer Support")) | .id')
BANKING_ID=$(curl -s "$API_URL/projects" | jq -r '.[] | select(.name | contains("Mobile Banking")) | .id')

create_story() {
    local project_id="$1"
    local title="$2"
    local description="$3"
    local criteria="$4"
    local labels="$5"
    local size="$6"
    local priority="$7"
    local status="$8"

    curl -s -X POST "$API_URL/projects/$project_id/stories" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"description\": \"$description\",
            \"acceptance_criteria\": $criteria,
            \"labels\": $labels,
            \"size\": \"$size\",
            \"priority\": \"$priority\",
            \"status\": \"$status\"
        }" > /dev/null
}

echo "Creating stories for AI Customer Support Chatbot..."

if [ -n "$CHATBOT_ID" ] && [ "$CHATBOT_ID" != "null" ]; then
    # Story 1
    create_story "$CHATBOT_ID" \
        "Customer asks chatbot about order status" \
        "As a customer, I want to ask the chatbot where my order is, so that I can get immediate tracking information without waiting for a human agent." \
        '["Given I am on the support chat, when I ask Where is my order?, then the chatbot asks for my order number or email", "Given I provide valid order information, when the chatbot looks up my order, then it displays current status and estimated delivery date", "Given my order is delayed, when status is retrieved, then the chatbot proactively offers tracking link and apology"]' \
        '["mvp", "core-feature", "order-management"]' \
        "m" "p1" "ready"

    # Story 2
    create_story "$CHATBOT_ID" \
        "Customer requests password reset via chatbot" \
        "As a customer, I want to reset my password through the chatbot, so that I don't have to search for the reset link or call support." \
        '["Given I say I forgot my password, when the chatbot processes the request, then it asks for my registered email", "Given I provide a valid email, when the chatbot sends reset link, then I receive it within 60 seconds", "Given I provide an unregistered email, when chatbot checks, then it offers to help create an account"]' \
        '["mvp", "authentication", "security"]' \
        "s" "p1" "ready"

    # Story 3
    create_story "$CHATBOT_ID" \
        "Chatbot escalates to human agent when stuck" \
        "As a customer, I want the chatbot to connect me to a human agent when it cannot help, so that I do not get stuck in an endless loop." \
        '["Given the chatbot confidence is below 80%, when it responds, then it offers to connect to a human agent", "Given I type speak to human or similar, when chatbot processes, then it immediately initiates handoff", "Given handoff is initiated, when agent becomes available, then full conversation history is visible to agent"]' \
        '["mvp", "escalation", "agent-handoff"]' \
        "m" "p1" "ready"

    # Story 4
    create_story "$CHATBOT_ID" \
        "Customer asks product questions" \
        "As a customer, I want to ask the chatbot about product features and availability, so that I can make informed purchase decisions." \
        '["Given I ask about a specific product, when chatbot searches catalog, then it shows product details, price, and availability", "Given I ask for product comparison, when chatbot processes, then it shows side-by-side feature comparison", "Given product is out of stock, when chatbot responds, then it offers notify-when-available option"]' \
        '["catalog", "product-info"]' \
        "m" "p2" "ready"

    # Story 5
    create_story "$CHATBOT_ID" \
        "Support manager views chatbot analytics" \
        "As a support manager, I want to see chatbot performance metrics, so that I can optimize the automated support experience." \
        '["Given I access the analytics dashboard, when I view chatbot metrics, then I see deflection rate, CSAT, and avg response time", "Given I select a date range, when metrics load, then data updates to reflect the selected period", "Given I click on a failed conversation, when details load, then I see the full transcript and failure reason"]' \
        '["analytics", "admin", "reporting"]' \
        "l" "p2" "draft"

    # Story 6
    create_story "$CHATBOT_ID" \
        "Chatbot responds in customer language" \
        "As an international customer, I want the chatbot to respond in my preferred language, so that I can communicate comfortably." \
        '["Given I start typing in Spanish, when chatbot detects language, then it responds in Spanish", "Given I switch languages mid-conversation, when chatbot processes, then it adapts to the new language", "Given a phrase is ambiguous, when chatbot is unsure, then it asks for language preference"]' \
        '["i18n", "multi-language"]' \
        "l" "p2" "draft"

    # Story 7
    create_story "$CHATBOT_ID" \
        "Customer initiates return through chatbot" \
        "As a customer, I want to start a return process through the chatbot, so that I do not have to navigate the website or call support." \
        '["Given I request a return, when chatbot verifies order, then it shows return eligibility status", "Given item is eligible, when I confirm return, then chatbot generates return label and instructions", "Given return window has expired, when chatbot checks, then it explains policy and offers manager escalation"]' \
        '["returns", "order-management"]' \
        "m" "p2" "draft"

    # Story 8
    create_story "$CHATBOT_ID" \
        "Chatbot greets returning customers" \
        "As a returning customer, I want the chatbot to recognize me, so that I do not have to provide my information again." \
        '["Given I am logged in and start chat, when chatbot initializes, then it greets me by name", "Given I have recent orders, when chatbot loads context, then it proactively mentions recent order status", "Given I have open support tickets, when chatbot checks, then it asks if I am following up on existing issue"]' \
        '["personalization", "context"]' \
        "s" "p3" "draft"

    echo "  ✓ Created 8 stories for AI Customer Support Chatbot"
else
    echo "  ✗ Chatbot project not found"
fi

echo "Creating stories for Mobile Banking Redesign..."

if [ -n "$BANKING_ID" ] && [ "$BANKING_ID" != "null" ]; then
    # Story 1
    create_story "$BANKING_ID" \
        "User logs in with Face ID" \
        "As a mobile banking user, I want to log in using Face ID, so that I can access my account quickly and securely." \
        '["Given Face ID is enabled on device, when I open the app, then biometric prompt appears automatically", "Given Face ID authentication succeeds, when verified, then I am taken directly to account dashboard", "Given Face ID fails 3 times, when I retry, then app prompts for password fallback"]' \
        '["authentication", "security", "ios"]' \
        "m" "p1" "ready"

    # Story 2
    create_story "$BANKING_ID" \
        "User sends money to saved contact" \
        "As a user, I want to send money to a saved recipient with minimal taps, so that transfers are quick and convenient." \
        '["Given I select a saved recipient, when I tap their name, then amount entry screen appears with recent amounts", "Given I enter an amount and confirm, when transaction processes, then confirmation shows within 3 seconds", "Given transfer succeeds, when confirmation shows, then both parties receive push notification"]' \
        '["transfers", "p2p", "core-feature"]' \
        "m" "p1" "ready"

    # Story 3
    create_story "$BANKING_ID" \
        "User views pending transactions" \
        "As a user, I want to see pending transactions in my balance, so that I have accurate visibility into my available funds." \
        '["Given I view my account balance, when transactions are pending, then balance shows Available vs Current amounts", "Given pending transactions exist, when I tap the balance, then I see itemized pending transactions", "Given a pending transaction clears, when it posts, then balance updates in real-time"]' \
        '["balance", "transactions", "real-time"]' \
        "l" "p1" "ready"

    # Story 4
    create_story "$BANKING_ID" \
        "User freezes debit card" \
        "As a user, I want to instantly freeze my debit card from the app, so that I can prevent fraud if my card is lost or stolen." \
        '["Given I navigate to card controls, when I tap freeze, then card is frozen within 5 seconds", "Given card is frozen, when a transaction is attempted, then it is declined and I receive alert", "Given I unfreeze the card, when I confirm, then card is immediately usable again"]' \
        '["card-controls", "security", "fraud-prevention"]' \
        "s" "p1" "ready"

    # Story 5
    create_story "$BANKING_ID" \
        "User views spending insights" \
        "As a user, I want to see my spending broken down by category, so that I can understand and manage my finances." \
        '["Given I navigate to insights, when data loads, then I see pie chart of spending by category", "Given I tap a category, when detail view opens, then I see all transactions in that category", "Given I view monthly trends, when I swipe between months, then comparison data is shown"]' \
        '["insights", "analytics", "financial-wellness"]' \
        "l" "p2" "draft"

    # Story 6
    create_story "$BANKING_ID" \
        "User sends money via QR code" \
        "As a user, I want to send money by scanning a QR code, so that I can pay someone without typing their details." \
        '["Given I tap Scan to Pay, when camera opens, then QR scanner is active with guide overlay", "Given I scan valid QR code, when decoded, then recipient name and suggested amount populate", "Given I confirm payment, when processed, then both parties see confirmation instantly"]' \
        '["p2p", "qr-code", "payments"]' \
        "m" "p2" "draft"

    echo "  ✓ Created 6 stories for Mobile Banking Redesign"
else
    echo "  ✗ Banking project not found"
fi

echo ""
echo "✅ User stories seeded successfully!"
echo ""
