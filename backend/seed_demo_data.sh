#!/bin/bash
# Seed script for demo data via API
# Creates believable sample projects at various stages

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_URL="$BASE_URL/api"

echo ""
echo "🌱 Seeding demo data via API..."
echo ""

# Function to create a project
create_project() {
    local name="$1"
    local description="$2"

    curl -s -X POST "$API_URL/projects" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$name\", \"description\": \"$description\"}" | jq -r '.id'
}

# Function to create a requirement
create_requirement() {
    local project_id="$1"
    local section="$2"
    local content="$3"

    curl -s -X POST "$API_URL/projects/$project_id/requirements" \
        -H "Content-Type: application/json" \
        -d "{\"section\": \"$section\", \"content\": \"$content\"}" > /dev/null
}

# Function to update project status
update_project_status() {
    local project_id="$1"
    local field="$2"
    local value="$3"

    curl -s -X PATCH "$API_URL/projects/$project_id" \
        -H "Content-Type: application/json" \
        -d "{\"$field\": \"$value\"}" > /dev/null
}

echo "Creating projects..."

# ============================================
# Project 1: AI Customer Support Chatbot (Complete)
# ============================================
PROJECT1_ID=$(create_project \
    "AI Customer Support Chatbot" \
    "An intelligent chatbot that handles tier-1 customer support inquiries, reduces response times, and escalates complex issues to human agents.")

if [ -n "$PROJECT1_ID" ] && [ "$PROJECT1_ID" != "null" ]; then
    echo "  ✓ Created: AI Customer Support Chatbot"

    # Requirements - Problems
    create_requirement "$PROJECT1_ID" "problems" "Customer support team is overwhelmed with 2,000+ tickets daily, 60% of which are repetitive tier-1 questions"
    create_requirement "$PROJECT1_ID" "problems" "Average response time is 4 hours during peak periods, leading to customer frustration and churn"
    create_requirement "$PROJECT1_ID" "problems" "Support agents spend 70% of their time on password resets, order status checks, and FAQ questions"
    create_requirement "$PROJECT1_ID" "problems" "No 24/7 support coverage - customers in different time zones wait 8+ hours for responses"

    # Requirements - User Goals
    create_requirement "$PROJECT1_ID" "user_goals" "Customers want instant answers to common questions without waiting in queue"
    create_requirement "$PROJECT1_ID" "user_goals" "Support agents want to focus on complex issues that require human judgment"
    create_requirement "$PROJECT1_ID" "user_goals" "Operations team wants to reduce support costs while improving customer satisfaction scores"
    create_requirement "$PROJECT1_ID" "user_goals" "IT team needs a solution that integrates with existing Zendesk ticketing system"

    # Requirements - Functional
    create_requirement "$PROJECT1_ID" "functional_requirements" "Chatbot must understand and respond to natural language questions about products, orders, and policies"
    create_requirement "$PROJECT1_ID" "functional_requirements" "System must authenticate users securely before providing account-specific information"
    create_requirement "$PROJECT1_ID" "functional_requirements" "Chatbot must gracefully escalate to human agents when confidence is below 80% or customer requests it"
    create_requirement "$PROJECT1_ID" "functional_requirements" "All conversations must be logged and searchable for quality assurance and training purposes"
    create_requirement "$PROJECT1_ID" "functional_requirements" "System must support multiple languages (English, Spanish, French) with automatic detection"
    create_requirement "$PROJECT1_ID" "functional_requirements" "Chatbot must integrate with order management system to provide real-time order status"

    # Requirements - Data Needs
    create_requirement "$PROJECT1_ID" "data_needs" "Access to product catalog with descriptions, pricing, and availability"
    create_requirement "$PROJECT1_ID" "data_needs" "Read-only access to customer order history and shipping status"
    create_requirement "$PROJECT1_ID" "data_needs" "Integration with knowledge base containing 500+ FAQ articles and policies"
    create_requirement "$PROJECT1_ID" "data_needs" "Historical chat logs for training and improving the AI model"

    # Requirements - Constraints
    create_requirement "$PROJECT1_ID" "constraints" "Must comply with GDPR and CCPA for handling personal customer data"
    create_requirement "$PROJECT1_ID" "constraints" "Response latency must be under 3 seconds for 95% of queries"
    create_requirement "$PROJECT1_ID" "constraints" "Solution must run on existing AWS infrastructure to minimize additional cloud costs"
    create_requirement "$PROJECT1_ID" "constraints" "Chatbot must not hallucinate or provide incorrect product information"

    # Requirements - Non Goals
    create_requirement "$PROJECT1_ID" "non_goals" "Processing payments or refunds through the chatbot - these require human approval"
    create_requirement "$PROJECT1_ID" "non_goals" "Handling complex disputes or escalated complaints - always route to senior agents"
    create_requirement "$PROJECT1_ID" "non_goals" "Replacing the entire support team - goal is augmentation, not replacement"
    create_requirement "$PROJECT1_ID" "non_goals" "Building custom NLP from scratch - will use established LLM providers"

    # Requirements - Risks
    create_requirement "$PROJECT1_ID" "risks_assumptions" "Assumption: Customers will accept chatbot interactions for simple queries based on industry benchmarks"
    create_requirement "$PROJECT1_ID" "risks_assumptions" "Risk: AI responses may occasionally be inappropriate or incorrect, requiring human oversight"
    create_requirement "$PROJECT1_ID" "risks_assumptions" "Assumption: Existing knowledge base content is accurate and up-to-date"
    create_requirement "$PROJECT1_ID" "risks_assumptions" "Risk: Integration with legacy order management system may be more complex than estimated"

    # Requirements - Open Questions
    create_requirement "$PROJECT1_ID" "open_questions" "Which LLM provider (OpenAI, Anthropic, or Google) best fits our security and cost requirements?"
    create_requirement "$PROJECT1_ID" "open_questions" "How should we handle the transition period - gradual rollout or big bang?"
    create_requirement "$PROJECT1_ID" "open_questions" "What metrics should define success - CSAT scores, deflection rate, or cost savings?"

    # Requirements - Action Items
    create_requirement "$PROJECT1_ID" "action_items" "Schedule security review with InfoSec team for AI vendor selection criteria"
    create_requirement "$PROJECT1_ID" "action_items" "Conduct user research with 20 customers to validate chatbot acceptance"
    create_requirement "$PROJECT1_ID" "action_items" "Get pricing quotes from top 3 LLM providers for expected query volume"

    # Update project status to completed state
    update_project_status "$PROJECT1_ID" "requirements_status" "reviewed"
    update_project_status "$PROJECT1_ID" "prd_status" "ready"
    update_project_status "$PROJECT1_ID" "stories_status" "refined"
    update_project_status "$PROJECT1_ID" "mockups_status" "generated"
    update_project_status "$PROJECT1_ID" "export_status" "exported"

else
    echo "  ✗ Failed to create AI Customer Support Chatbot"
fi

# ============================================
# Project 2: Mobile Banking Redesign (Stories stage)
# ============================================
PROJECT2_ID=$(create_project \
    "Mobile Banking Redesign" \
    "Complete redesign of the mobile banking experience with focus on quick transfers, bill payments, and financial insights.")

if [ -n "$PROJECT2_ID" ] && [ "$PROJECT2_ID" != "null" ]; then
    echo "  ✓ Created: Mobile Banking Redesign"

    # Requirements - Problems
    create_requirement "$PROJECT2_ID" "problems" "Current app requires 7 taps to complete a simple money transfer, competitors average 3 taps"
    create_requirement "$PROJECT2_ID" "problems" "App crashes on 15% of Android devices during bill payment flow"
    create_requirement "$PROJECT2_ID" "problems" "Users cannot view pending transactions, leading to overdrafts and customer complaints"
    create_requirement "$PROJECT2_ID" "problems" "No biometric authentication option - customers must type full password every time"

    # Requirements - User Goals
    create_requirement "$PROJECT2_ID" "user_goals" "Complete transfers to saved recipients in under 10 seconds"
    create_requirement "$PROJECT2_ID" "user_goals" "View all account activity including pending transactions in one place"
    create_requirement "$PROJECT2_ID" "user_goals" "Set up recurring transfers and bill payments without calling customer service"
    create_requirement "$PROJECT2_ID" "user_goals" "Receive instant notifications for all account activity with customizable thresholds"

    # Requirements - Functional
    create_requirement "$PROJECT2_ID" "functional_requirements" "Support Face ID, Touch ID, and fingerprint authentication with password fallback"
    create_requirement "$PROJECT2_ID" "functional_requirements" "Display real-time balance including pending transactions and holds"
    create_requirement "$PROJECT2_ID" "functional_requirements" "Enable P2P transfers via phone number, email, or QR code scanning"
    create_requirement "$PROJECT2_ID" "functional_requirements" "Allow users to freeze/unfreeze debit card instantly from the app"
    create_requirement "$PROJECT2_ID" "functional_requirements" "Provide spending insights with category breakdown and month-over-month trends"
    create_requirement "$PROJECT2_ID" "functional_requirements" "Support dark mode and accessibility features including screen reader compatibility"

    # Requirements - Data Needs
    create_requirement "$PROJECT2_ID" "data_needs" "Real-time account balance and transaction feed from core banking system"
    create_requirement "$PROJECT2_ID" "data_needs" "Customer profile data including saved payees and recurring payments"
    create_requirement "$PROJECT2_ID" "data_needs" "Transaction categorization data for spending insights feature"

    # Requirements - Constraints
    create_requirement "$PROJECT2_ID" "constraints" "Must pass PCI-DSS compliance audit before launch"
    create_requirement "$PROJECT2_ID" "constraints" "Must support iOS 14+ and Android 10+ to cover 95% of current user base"
    create_requirement "$PROJECT2_ID" "constraints" "Maximum app size of 50MB to ensure quick downloads on cellular networks"
    create_requirement "$PROJECT2_ID" "constraints" "All API calls must complete within 2 seconds under normal load"

    # Requirements - Non Goals
    create_requirement "$PROJECT2_ID" "non_goals" "Investment and brokerage features - separate app handles wealth management"
    create_requirement "$PROJECT2_ID" "non_goals" "Business banking features - focus is retail customers only"
    create_requirement "$PROJECT2_ID" "non_goals" "Crypto wallet or trading capabilities - not aligned with current regulatory approach"

    # Requirements - Risks
    create_requirement "$PROJECT2_ID" "risks_assumptions" "Assumption: Core banking APIs can handle 3x current traffic for new features"
    create_requirement "$PROJECT2_ID" "risks_assumptions" "Risk: Biometric authentication may not work reliably on older Android devices"
    create_requirement "$PROJECT2_ID" "risks_assumptions" "Assumption: Users will opt-in to push notifications for transaction alerts"

    # Requirements - Open Questions
    create_requirement "$PROJECT2_ID" "open_questions" "Should we allow transfers to non-customers or only bank-to-bank transfers?"
    create_requirement "$PROJECT2_ID" "open_questions" "What is the daily/monthly transfer limit for P2P payments?"

    # Requirements - Action Items
    create_requirement "$PROJECT2_ID" "action_items" "Finalize API contract with core banking team by end of sprint"
    create_requirement "$PROJECT2_ID" "action_items" "Complete security penetration testing before beta release"

    # Update project status
    update_project_status "$PROJECT2_ID" "requirements_status" "reviewed"
    update_project_status "$PROJECT2_ID" "prd_status" "ready"
    update_project_status "$PROJECT2_ID" "stories_status" "generated"

else
    echo "  ✗ Failed to create Mobile Banking Redesign"
fi

# ============================================
# Project 3: Employee Onboarding Portal (PRD stage)
# ============================================
PROJECT3_ID=$(create_project \
    "Employee Onboarding Portal" \
    "Self-service portal for new hires to complete paperwork, access training materials, and meet their team before day one.")

if [ -n "$PROJECT3_ID" ] && [ "$PROJECT3_ID" != "null" ]; then
    echo "  ✓ Created: Employee Onboarding Portal"

    # Requirements - Problems
    create_requirement "$PROJECT3_ID" "problems" "New hires spend their first day filling out paper forms instead of meeting their team"
    create_requirement "$PROJECT3_ID" "problems" "HR spends 4 hours per new hire manually entering data into 5 different systems"
    create_requirement "$PROJECT3_ID" "problems" "30% of new hires don't have laptop and system access ready on day one"
    create_requirement "$PROJECT3_ID" "problems" "No centralized place for new employees to find company information and policies"

    # Requirements - User Goals
    create_requirement "$PROJECT3_ID" "user_goals" "New hires want to complete all paperwork before their start date"
    create_requirement "$PROJECT3_ID" "user_goals" "Managers want visibility into their new hire's onboarding progress"
    create_requirement "$PROJECT3_ID" "user_goals" "HR wants to automate repetitive data entry and focus on employee experience"
    create_requirement "$PROJECT3_ID" "user_goals" "IT wants advance notice of equipment needs to prepare in time"

    # Requirements - Functional
    create_requirement "$PROJECT3_ID" "functional_requirements" "Digital forms for tax documents (W-4, I-9), emergency contacts, and direct deposit"
    create_requirement "$PROJECT3_ID" "functional_requirements" "Document upload for identity verification with secure storage"
    create_requirement "$PROJECT3_ID" "functional_requirements" "Onboarding checklist with progress tracking visible to employee, manager, and HR"
    create_requirement "$PROJECT3_ID" "functional_requirements" "Automated provisioning requests to IT for laptop, email, and system access"
    create_requirement "$PROJECT3_ID" "functional_requirements" "Welcome video and company culture content before day one"
    create_requirement "$PROJECT3_ID" "functional_requirements" "Virtual meet-the-team page with photos and bios of direct team members"

    # Requirements - Data Needs
    create_requirement "$PROJECT3_ID" "data_needs" "Integration with Workday for employee master data sync"
    create_requirement "$PROJECT3_ID" "data_needs" "Active Directory integration for account provisioning"
    create_requirement "$PROJECT3_ID" "data_needs" "Access to org chart data for team information display"

    # Requirements - Constraints
    create_requirement "$PROJECT3_ID" "constraints" "Must be accessible on mobile devices since many hires don't have work laptops yet"
    create_requirement "$PROJECT3_ID" "constraints" "Personal data handling must comply with SOC 2 and local employment laws"
    create_requirement "$PROJECT3_ID" "constraints" "Solution should work for both US and international hires"

    # Requirements - Non Goals
    create_requirement "$PROJECT3_ID" "non_goals" "Performance review or goal-setting features - handled in Workday"
    create_requirement "$PROJECT3_ID" "non_goals" "Benefits enrollment - separate benefits portal handles this"
    create_requirement "$PROJECT3_ID" "non_goals" "Training/LMS content - focus is pre-day-one and week-one only"

    # Requirements - Risks
    create_requirement "$PROJECT3_ID" "risks_assumptions" "Assumption: Workday APIs support the data fields we need for integration"
    create_requirement "$PROJECT3_ID" "risks_assumptions" "Risk: International compliance requirements may vary significantly by country"

    # Requirements - Open Questions
    create_requirement "$PROJECT3_ID" "open_questions" "Should contractors use the same portal or a simplified version?"
    create_requirement "$PROJECT3_ID" "open_questions" "What is the timeline for international rollout after US pilot?"

    # Requirements - Action Items
    create_requirement "$PROJECT3_ID" "action_items" "Review Workday API documentation with integration team"
    create_requirement "$PROJECT3_ID" "action_items" "Get legal review of data handling across different countries"

    # Update project status
    update_project_status "$PROJECT3_ID" "requirements_status" "reviewed"
    update_project_status "$PROJECT3_ID" "prd_status" "draft"

else
    echo "  ✗ Failed to create Employee Onboarding Portal"
fi

# ============================================
# Project 4: Inventory Management System (Early stage)
# ============================================
PROJECT4_ID=$(create_project \
    "Inventory Management System" \
    "Real-time inventory tracking for warehouse operations with barcode scanning, low-stock alerts, and supplier integration.")

if [ -n "$PROJECT4_ID" ] && [ "$PROJECT4_ID" != "null" ]; then
    echo "  ✓ Created: Inventory Management System"

    # Requirements - Problems
    create_requirement "$PROJECT4_ID" "problems" "Warehouse staff uses paper logs to track inventory, leading to errors and missing items"
    create_requirement "$PROJECT4_ID" "problems" "No visibility into real-time stock levels - orders are placed based on weekly manual counts"
    create_requirement "$PROJECT4_ID" "problems" "Frequent stockouts of popular items because reorder alerts are based on outdated data"

    # Requirements - User Goals
    create_requirement "$PROJECT4_ID" "user_goals" "Warehouse managers want real-time visibility into inventory across all locations"
    create_requirement "$PROJECT4_ID" "user_goals" "Purchasing team wants automated low-stock alerts based on sales velocity"
    create_requirement "$PROJECT4_ID" "user_goals" "Operations wants to reduce inventory holding costs while preventing stockouts"

    # Requirements - Functional
    create_requirement "$PROJECT4_ID" "functional_requirements" "Barcode and QR code scanning for receiving, picking, and shipping operations"
    create_requirement "$PROJECT4_ID" "functional_requirements" "Real-time dashboard showing stock levels, locations, and movements"
    create_requirement "$PROJECT4_ID" "functional_requirements" "Automated reorder point alerts with configurable thresholds per SKU"

    # Requirements - Data Needs
    create_requirement "$PROJECT4_ID" "data_needs" "Product master data including SKU, description, and category"
    create_requirement "$PROJECT4_ID" "data_needs" "Historical sales data for demand forecasting and reorder calculations"

    # Requirements - Constraints
    create_requirement "$PROJECT4_ID" "constraints" "Must work offline in warehouse areas with poor WiFi coverage"
    create_requirement "$PROJECT4_ID" "constraints" "Scanning devices must be rugged and suitable for warehouse environment"

    # Requirements - Open Questions
    create_requirement "$PROJECT4_ID" "open_questions" "Should we build mobile app or use dedicated scanning hardware?"
    create_requirement "$PROJECT4_ID" "open_questions" "Integration with which ERP system - SAP or NetSuite?"

    # Requirements - Action Items
    create_requirement "$PROJECT4_ID" "action_items" "Site visit to main warehouse to understand current workflows"
    create_requirement "$PROJECT4_ID" "action_items" "Get quotes for barcode scanning hardware options"

    # Update project status
    update_project_status "$PROJECT4_ID" "requirements_status" "has_items"

else
    echo "  ✗ Failed to create Inventory Management System"
fi

# ============================================
# Project 5: Legacy Project (Archived)
# ============================================
PROJECT5_ID=$(create_project \
    "Legacy CRM Migration (Cancelled)" \
    "Migration of customer data from legacy CRM to new Salesforce instance - project cancelled due to vendor change.")

if [ -n "$PROJECT5_ID" ] && [ "$PROJECT5_ID" != "null" ]; then
    echo "  ✓ Created: Legacy CRM Migration (Cancelled)"

    # Just a few requirements to show it had started
    create_requirement "$PROJECT5_ID" "problems" "Customer data scattered across 3 legacy systems with no single source of truth"
    create_requirement "$PROJECT5_ID" "problems" "Sales team losing deals because they don't have complete customer history"
    create_requirement "$PROJECT5_ID" "user_goals" "Sales wants unified view of all customer interactions across systems"
    create_requirement "$PROJECT5_ID" "user_goals" "Marketing needs clean customer segmentation data for campaigns"

    # Update project status and archive it
    update_project_status "$PROJECT5_ID" "requirements_status" "has_items"
    update_project_status "$PROJECT5_ID" "archived" "true"

else
    echo "  ✗ Failed to create Legacy CRM Migration"
fi

echo ""
echo "✅ Demo data seeded successfully!"
echo ""
echo "Projects at various stages:"
echo "  1. AI Customer Support Chatbot - Complete (all stages done)"
echo "  2. Mobile Banking Redesign - Stories stage"
echo "  3. Employee Onboarding Portal - PRD stage"
echo "  4. Inventory Management System - Requirements stage"
echo "  5. Legacy CRM Migration - Archived"
echo ""
