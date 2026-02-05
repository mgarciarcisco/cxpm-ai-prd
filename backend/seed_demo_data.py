#!/usr/bin/env python3
"""
Seed script for demo data.
Creates believable sample projects at various stages of completion.

Run with: python seed_demo_data.py
"""

import uuid
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import (
    PRD,
    ExportStatus,
    MockupsStatus,
    PRDMode,
    PRDStageStatus,
    PRDStatus,
    Project,
    Requirement,
    RequirementsStatus,
    Section,
    StoriesStatus,
    StoryBatch,
    StoryBatchStatus,
    StoryFormat,
    StoryPriority,
    StorySize,
    StoryStatus,
    User,
    UserStory,
)
from app.auth import hash_password


def clear_existing_data(db):
    """Clear all existing data from the database."""
    db.query(UserStory).delete()
    db.query(StoryBatch).delete()
    db.query(PRD).delete()
    db.query(Requirement).delete()
    db.query(Project).delete()
    db.query(User).delete()
    db.commit()
    print("✓ Cleared existing data")


def create_demo_user(db):
    """Create a demo user for seeded data."""
    user = User(
        id="demo-user-0000-0000-000000000001",
        email="demo@example.com",
        name="Demo User",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_admin=True,
    )
    db.add(user)
    db.commit()
    print("✓ Created demo user (demo@example.com / password123)")
    return user


def create_projects(db, user_id):
    """Create sample projects at various stages."""
    now = datetime.utcnow()

    projects = [
        # Project 1: Fully completed - AI Customer Support Chatbot
        Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name="AI Customer Support Chatbot",
            description="An intelligent chatbot that handles tier-1 customer support inquiries, reduces response times, and escalates complex issues to human agents.",
            archived=False,
            created_at=now - timedelta(days=45),
            updated_at=now - timedelta(days=2),
            requirements_status=RequirementsStatus.reviewed,
            prd_status=PRDStageStatus.ready,
            stories_status=StoriesStatus.refined,
            mockups_status=MockupsStatus.generated,
            export_status=ExportStatus.exported,
        ),
        # Project 2: In Stories stage - Mobile Banking App
        Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name="Mobile Banking Redesign",
            description="Complete redesign of the mobile banking experience with focus on quick transfers, bill payments, and financial insights.",
            archived=False,
            created_at=now - timedelta(days=30),
            updated_at=now - timedelta(hours=6),
            requirements_status=RequirementsStatus.reviewed,
            prd_status=PRDStageStatus.ready,
            stories_status=StoriesStatus.generated,
            mockups_status=MockupsStatus.empty,
            export_status=ExportStatus.not_exported,
        ),
        # Project 3: In PRD stage - Employee Onboarding Portal
        Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name="Employee Onboarding Portal",
            description="Self-service portal for new hires to complete paperwork, access training materials, and meet their team before day one.",
            archived=False,
            created_at=now - timedelta(days=14),
            updated_at=now - timedelta(hours=2),
            requirements_status=RequirementsStatus.reviewed,
            prd_status=PRDStageStatus.draft,
            stories_status=StoriesStatus.empty,
            mockups_status=MockupsStatus.empty,
            export_status=ExportStatus.not_exported,
        ),
        # Project 4: Just started - Inventory Management System
        Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name="Inventory Management System",
            description="Real-time inventory tracking for warehouse operations with barcode scanning, low-stock alerts, and supplier integration.",
            archived=False,
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(hours=12),
            requirements_status=RequirementsStatus.has_items,
            prd_status=PRDStageStatus.empty,
            stories_status=StoriesStatus.empty,
            mockups_status=MockupsStatus.empty,
            export_status=ExportStatus.not_exported,
        ),
        # Project 5: Archived project
        Project(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name="Legacy CRM Migration (Cancelled)",
            description="Migration of customer data from legacy CRM to new Salesforce instance - project cancelled due to vendor change.",
            archived=True,
            created_at=now - timedelta(days=90),
            updated_at=now - timedelta(days=60),
            requirements_status=RequirementsStatus.has_items,
            prd_status=PRDStageStatus.empty,
            stories_status=StoriesStatus.empty,
            mockups_status=MockupsStatus.empty,
            export_status=ExportStatus.not_exported,
        ),
    ]

    for project in projects:
        db.add(project)
    db.commit()

    print(f"✓ Created {len(projects)} projects")
    return projects


def create_requirements_for_project(db, project, requirements_data):
    """Create requirements for a project."""
    order = 0
    for section, items in requirements_data.items():
        for content in items:
            req = Requirement(
                id=str(uuid.uuid4()),
                project_id=project.id,
                section=section,
                content=content,
                order=order,
                is_active=True,
            )
            db.add(req)
            order += 1
    db.commit()


def create_all_requirements(db, projects):
    """Create requirements for all active projects."""

    # AI Customer Support Chatbot (Project 1) - Complete requirements
    chatbot_reqs = {
        Section.problems: [
            "Customer support team is overwhelmed with 2,000+ tickets daily, 60% of which are repetitive tier-1 questions",
            "Average response time is 4 hours during peak periods, leading to customer frustration and churn",
            "Support agents spend 70% of their time on password resets, order status checks, and FAQ questions",
            "No 24/7 support coverage - customers in different time zones wait 8+ hours for responses",
        ],
        Section.user_goals: [
            "Customers want instant answers to common questions without waiting in queue",
            "Support agents want to focus on complex issues that require human judgment",
            "Operations team wants to reduce support costs while improving customer satisfaction scores",
            "IT team needs a solution that integrates with existing Zendesk ticketing system",
        ],
        Section.functional_requirements: [
            "Chatbot must understand and respond to natural language questions about products, orders, and policies",
            "System must authenticate users securely before providing account-specific information",
            "Chatbot must gracefully escalate to human agents when confidence is below 80% or customer requests it",
            "All conversations must be logged and searchable for quality assurance and training purposes",
            "System must support multiple languages (English, Spanish, French) with automatic detection",
            "Chatbot must integrate with order management system to provide real-time order status",
        ],
        Section.data_needs: [
            "Access to product catalog with descriptions, pricing, and availability",
            "Read-only access to customer order history and shipping status",
            "Integration with knowledge base containing 500+ FAQ articles and policies",
            "Historical chat logs for training and improving the AI model",
        ],
        Section.constraints: [
            "Must comply with GDPR and CCPA for handling personal customer data",
            "Response latency must be under 3 seconds for 95% of queries",
            "Solution must run on existing AWS infrastructure to minimize additional cloud costs",
            "Chatbot must not hallucinate or provide incorrect product information",
        ],
        Section.non_goals: [
            "Processing payments or refunds through the chatbot - these require human approval",
            "Handling complex disputes or escalated complaints - always route to senior agents",
            "Replacing the entire support team - goal is augmentation, not replacement",
            "Building custom NLP from scratch - will use established LLM providers",
        ],
        Section.risks_assumptions: [
            "Assumption: Customers will accept chatbot interactions for simple queries based on industry benchmarks",
            "Risk: AI responses may occasionally be inappropriate or incorrect, requiring human oversight",
            "Assumption: Existing knowledge base content is accurate and up-to-date",
            "Risk: Integration with legacy order management system may be more complex than estimated",
        ],
        Section.open_questions: [
            "Which LLM provider (OpenAI, Anthropic, or Google) best fits our security and cost requirements?",
            "How should we handle the transition period - gradual rollout or big bang?",
            "What metrics should define success - CSAT scores, deflection rate, or cost savings?",
        ],
        Section.action_items: [
            "Schedule security review with InfoSec team for AI vendor selection criteria",
            "Conduct user research with 20 customers to validate chatbot acceptance",
            "Get pricing quotes from top 3 LLM providers for expected query volume",
        ],
    }
    create_requirements_for_project(db, projects[0], chatbot_reqs)

    # Mobile Banking Redesign (Project 2)
    banking_reqs = {
        Section.problems: [
            "Current app requires 7 taps to complete a simple money transfer, competitors average 3 taps",
            "App crashes on 15% of Android devices during bill payment flow",
            "Users cannot view pending transactions, leading to overdrafts and customer complaints",
            "No biometric authentication option - customers must type full password every time",
        ],
        Section.user_goals: [
            "Complete transfers to saved recipients in under 10 seconds",
            "View all account activity including pending transactions in one place",
            "Set up recurring transfers and bill payments without calling customer service",
            "Receive instant notifications for all account activity with customizable thresholds",
        ],
        Section.functional_requirements: [
            "Support Face ID, Touch ID, and fingerprint authentication with password fallback",
            "Display real-time balance including pending transactions and holds",
            "Enable P2P transfers via phone number, email, or QR code scanning",
            "Allow users to freeze/unfreeze debit card instantly from the app",
            "Provide spending insights with category breakdown and month-over-month trends",
            "Support dark mode and accessibility features including screen reader compatibility",
        ],
        Section.data_needs: [
            "Real-time account balance and transaction feed from core banking system",
            "Customer profile data including saved payees and recurring payments",
            "Transaction categorization data for spending insights feature",
        ],
        Section.constraints: [
            "Must pass PCI-DSS compliance audit before launch",
            "Must support iOS 14+ and Android 10+ to cover 95% of current user base",
            "Maximum app size of 50MB to ensure quick downloads on cellular networks",
            "All API calls must complete within 2 seconds under normal load",
        ],
        Section.non_goals: [
            "Investment and brokerage features - separate app handles wealth management",
            "Business banking features - focus is retail customers only",
            "Crypto wallet or trading capabilities - not aligned with current regulatory approach",
        ],
        Section.risks_assumptions: [
            "Assumption: Core banking APIs can handle 3x current traffic for new features",
            "Risk: Biometric authentication may not work reliably on older Android devices",
            "Assumption: Users will opt-in to push notifications for transaction alerts",
        ],
        Section.open_questions: [
            "Should we allow transfers to non-customers or only bank-to-bank transfers?",
            "What is the daily/monthly transfer limit for P2P payments?",
        ],
        Section.action_items: [
            "Finalize API contract with core banking team by end of sprint",
            "Complete security penetration testing before beta release",
        ],
    }
    create_requirements_for_project(db, projects[1], banking_reqs)

    # Employee Onboarding Portal (Project 3)
    onboarding_reqs = {
        Section.problems: [
            "New hires spend their first day filling out paper forms instead of meeting their team",
            "HR spends 4 hours per new hire manually entering data into 5 different systems",
            "30% of new hires don't have laptop and system access ready on day one",
            "No centralized place for new employees to find company information and policies",
        ],
        Section.user_goals: [
            "New hires want to complete all paperwork before their start date",
            "Managers want visibility into their new hire's onboarding progress",
            "HR wants to automate repetitive data entry and focus on employee experience",
            "IT wants advance notice of equipment needs to prepare in time",
        ],
        Section.functional_requirements: [
            "Digital forms for tax documents (W-4, I-9), emergency contacts, and direct deposit",
            "Document upload for identity verification with secure storage",
            "Onboarding checklist with progress tracking visible to employee, manager, and HR",
            "Automated provisioning requests to IT for laptop, email, and system access",
            "Welcome video and company culture content before day one",
            "Virtual meet-the-team page with photos and bios of direct team members",
        ],
        Section.data_needs: [
            "Integration with Workday for employee master data sync",
            "Active Directory integration for account provisioning",
            "Access to org chart data for team information display",
        ],
        Section.constraints: [
            "Must be accessible on mobile devices since many hires don't have work laptops yet",
            "Personal data handling must comply with SOC 2 and local employment laws",
            "Solution should work for both US and international hires",
        ],
        Section.non_goals: [
            "Performance review or goal-setting features - handled in Workday",
            "Benefits enrollment - separate benefits portal handles this",
            "Training/LMS content - focus is pre-day-one and week-one only",
        ],
        Section.risks_assumptions: [
            "Assumption: Workday APIs support the data fields we need for integration",
            "Risk: International compliance requirements may vary significantly by country",
        ],
        Section.open_questions: [
            "Should contractors use the same portal or a simplified version?",
            "What is the timeline for international rollout after US pilot?",
        ],
        Section.action_items: [
            "Review Workday API documentation with integration team",
            "Get legal review of data handling across different countries",
        ],
    }
    create_requirements_for_project(db, projects[2], onboarding_reqs)

    # Inventory Management System (Project 4) - Early stage, fewer requirements
    inventory_reqs = {
        Section.problems: [
            "Warehouse staff uses paper logs to track inventory, leading to errors and missing items",
            "No visibility into real-time stock levels - orders are placed based on weekly manual counts",
            "Frequent stockouts of popular items because reorder alerts are based on outdated data",
        ],
        Section.user_goals: [
            "Warehouse managers want real-time visibility into inventory across all locations",
            "Purchasing team wants automated low-stock alerts based on sales velocity",
            "Operations wants to reduce inventory holding costs while preventing stockouts",
        ],
        Section.functional_requirements: [
            "Barcode and QR code scanning for receiving, picking, and shipping operations",
            "Real-time dashboard showing stock levels, locations, and movements",
            "Automated reorder point alerts with configurable thresholds per SKU",
        ],
        Section.data_needs: [
            "Product master data including SKU, description, and category",
            "Historical sales data for demand forecasting and reorder calculations",
        ],
        Section.constraints: [
            "Must work offline in warehouse areas with poor WiFi coverage",
            "Scanning devices must be rugged and suitable for warehouse environment",
        ],
        Section.open_questions: [
            "Should we build mobile app or use dedicated scanning hardware?",
            "Integration with which ERP system - SAP or NetSuite?",
        ],
        Section.action_items: [
            "Site visit to main warehouse to understand current workflows",
            "Get quotes for barcode scanning hardware options",
        ],
    }
    create_requirements_for_project(db, projects[3], inventory_reqs)

    print("✓ Created requirements for all projects")


def create_prds(db, projects):
    """Create PRDs for projects that have reached that stage."""

    # PRD for AI Chatbot (complete)
    chatbot_prd = PRD(
        id=str(uuid.uuid4()),
        project_id=projects[0].id,
        version=1,
        title="AI Customer Support Chatbot - Product Requirements Document",
        mode=PRDMode.DETAILED,
        status=PRDStatus.READY,
        sections=[
            {
                "title": "Executive Summary",
                "content": """This document outlines the requirements for an AI-powered customer support chatbot designed to handle tier-1 support inquiries, reduce response times from 4 hours to under 30 seconds, and allow human agents to focus on complex issues.

**Key Objectives:**
- Deflect 60% of tier-1 support tickets through automated responses
- Provide 24/7 customer support coverage across all time zones
- Integrate seamlessly with existing Zendesk ticketing system
- Maintain customer satisfaction scores at or above current levels

**Success Metrics:**
- Ticket deflection rate ≥ 60%
- Average response time < 30 seconds
- Customer satisfaction (CSAT) ≥ 85%
- Agent productivity increase ≥ 40%"""
            },
            {
                "title": "Problem Statement",
                "content": """Our customer support team faces unsustainable scaling challenges:

1. **Volume Overload**: Processing 2,000+ tickets daily with 60% being repetitive tier-1 questions that could be automated.

2. **Response Time Degradation**: Average response time has grown to 4 hours during peak periods, directly impacting customer satisfaction and contributing to a 15% increase in churn among affected customers.

3. **Agent Burnout**: Support agents spend 70% of their time on repetitive tasks (password resets, order status, FAQs), leading to decreased job satisfaction and higher turnover.

4. **Coverage Gaps**: No 24/7 support means customers in different time zones wait 8+ hours for responses, creating inequitable service levels."""
            },
            {
                "title": "User Personas",
                "content": """**Persona 1: Sarah - The Busy Customer**
- Age: 35, working professional
- Needs quick answers to simple questions about orders
- Prefers self-service over waiting on hold
- Expects immediate responses, especially outside business hours
- Frustrated by having to repeat information to multiple agents

**Persona 2: Marcus - The Support Agent**
- 3 years experience in customer support
- Handles 50+ tickets per day
- Wants to solve meaningful problems, not reset passwords
- Needs tools that make his job easier, not harder
- Values accurate information at his fingertips

**Persona 3: Jennifer - The Support Manager**
- Manages team of 15 support agents
- Responsible for CSAT scores and SLA compliance
- Needs visibility into chatbot performance
- Concerned about maintaining quality during automation"""
            },
            {
                "title": "Functional Requirements",
                "content": """**FR-1: Natural Language Understanding**
The chatbot shall understand and respond to customer queries expressed in natural language, including:
- Product questions and comparisons
- Order status and shipping inquiries
- Return and refund policies
- Account management requests

**FR-2: User Authentication**
The system shall authenticate users securely before providing account-specific information:
- Support email-based magic link authentication
- Integrate with existing SSO for logged-in customers
- Require re-authentication for sensitive operations

**FR-3: Intelligent Escalation**
The chatbot shall escalate to human agents when:
- Confidence score falls below 80%
- Customer explicitly requests human assistance
- Query involves sensitive topics (complaints, disputes)
- Sentiment analysis detects customer frustration

**FR-4: Multi-language Support**
The system shall support:
- English, Spanish, and French languages
- Automatic language detection based on user input
- Seamless language switching mid-conversation

**FR-5: System Integration**
The chatbot shall integrate with:
- Zendesk for ticket creation and handoff
- Order Management System for real-time order status
- Knowledge Base for FAQ content retrieval"""
            },
            {
                "title": "Non-Functional Requirements",
                "content": """**Performance**
- Response latency: < 3 seconds for 95th percentile
- System availability: 99.9% uptime SLA
- Concurrent users: Support 1,000+ simultaneous conversations

**Security**
- GDPR and CCPA compliance for personal data handling
- Encryption at rest and in transit (TLS 1.3)
- Regular security audits and penetration testing
- Data retention policy: 90 days for chat logs

**Scalability**
- Auto-scaling to handle 3x normal traffic
- Geographic distribution for low-latency global access"""
            },
            {
                "title": "Technical Architecture",
                "content": """**High-Level Architecture**
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web/App   │────▶│   API GW     │────▶│  Chatbot    │
│   Client    │◀────│  (Kong)      │◀────│  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
              ┌──────────┐            ┌──────────────┐           ┌──────────────┐
              │   LLM    │            │  Knowledge   │           │   Zendesk    │
              │ Provider │            │    Base      │           │     API      │
              └──────────┘            └──────────────┘           └──────────────┘
```

**Technology Stack**
- Backend: Python FastAPI
- LLM: Claude API (Anthropic)
- Vector DB: Pinecone for knowledge retrieval
- Cache: Redis for session management
- Infrastructure: AWS EKS with auto-scaling"""
            },
            {
                "title": "Success Metrics & KPIs",
                "content": """| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Ticket Deflection Rate | 0% | 60% | Automated tickets / Total tickets |
| Average Response Time | 4 hours | < 30 seconds | Time to first response |
| CSAT Score | 78% | ≥ 85% | Post-chat survey |
| Agent Productivity | Baseline | +40% | Tickets resolved per agent |
| First Contact Resolution | 45% | 70% | Issues resolved without escalation |
| Cost per Ticket | $12 | $4 | Total support cost / Tickets |"""
            },
            {
                "title": "Timeline & Milestones",
                "content": """**Phase 1: Foundation (Weeks 1-4)**
- Infrastructure setup and API integrations
- Basic Q&A functionality with knowledge base
- Internal testing with support team

**Phase 2: Intelligence (Weeks 5-8)**
- LLM integration for natural language understanding
- Authentication and order status features
- Escalation workflow implementation

**Phase 3: Pilot (Weeks 9-10)**
- Beta launch with 10% of traffic
- Monitor metrics and gather feedback
- Iterate based on real-world performance

**Phase 4: Rollout (Weeks 11-12)**
- Gradual traffic increase to 100%
- Training for support team on chatbot handoff
- Documentation and runbook creation"""
            },
        ],
        raw_markdown=None,
        sections_completed=8,
        sections_total=8,
        created_by="system",
    )
    db.add(chatbot_prd)

    # PRD for Mobile Banking (complete)
    banking_prd = PRD(
        id=str(uuid.uuid4()),
        project_id=projects[1].id,
        version=1,
        title="Mobile Banking Redesign - Product Requirements Document",
        mode=PRDMode.DETAILED,
        status=PRDStatus.READY,
        sections=[
            {
                "title": "Executive Summary",
                "content": """This PRD outlines the complete redesign of our mobile banking application with focus on streamlined transfers, modern authentication, and financial insights.

**Key Objectives:**
- Reduce transfer completion from 7 taps to 3 taps
- Achieve 99.5% app stability across all supported devices
- Launch biometric authentication for faster, secure access
- Provide real-time transaction visibility including pending items"""
            },
            {
                "title": "Problem Statement",
                "content": """Our mobile banking app lags behind competitors in usability and reliability:

1. **Poor UX**: Simple transfers require 7 taps vs. industry-leading 3 taps
2. **Stability Issues**: 15% crash rate on Android during bill payments
3. **Limited Visibility**: Users cannot see pending transactions, causing overdrafts
4. **Outdated Auth**: Password-only login while competitors offer biometrics"""
            },
            {
                "title": "Core Features",
                "content": """**Feature 1: Quick Transfer**
- One-tap transfers to saved recipients
- P2P via phone/email/QR code
- Transaction confirmation with undo option

**Feature 2: Biometric Authentication**
- Face ID and Touch ID support
- Fingerprint for Android devices
- Secure fallback to password

**Feature 3: Real-Time Balance**
- Live balance including pending transactions
- Instant notification on all activity
- Spending categorization and trends

**Feature 4: Card Controls**
- Instant freeze/unfreeze
- Transaction alerts by amount/category
- International usage toggle"""
            },
        ],
        raw_markdown=None,
        sections_completed=4,
        sections_total=4,
        created_by="system",
    )
    db.add(banking_prd)

    # PRD for Onboarding Portal (draft)
    onboarding_prd = PRD(
        id=str(uuid.uuid4()),
        project_id=projects[2].id,
        version=1,
        title="Employee Onboarding Portal - Draft PRD",
        mode=PRDMode.DRAFT,
        status=PRDStatus.READY,
        sections=[
            {
                "title": "Executive Summary",
                "content": """A self-service onboarding portal enabling new hires to complete paperwork, access training materials, and connect with their team before day one.

**Goals:**
- Eliminate paper-based onboarding forms
- Reduce HR manual data entry by 80%
- Ensure 100% of new hires have Day 1 readiness"""
            },
            {
                "title": "Problem Statement",
                "content": """Current onboarding is inefficient and creates poor first impressions:
- First day spent on paperwork instead of team integration
- HR spends 4 hours per hire on manual data entry
- 30% of new hires lack proper system access on Day 1"""
            },
        ],
        raw_markdown=None,
        sections_completed=2,
        sections_total=6,
        created_by="system",
    )
    db.add(onboarding_prd)

    db.commit()
    print("✓ Created PRDs for 3 projects")


def create_user_stories(db, projects):
    """Create user stories for projects that have reached that stage."""

    # Story batch for Chatbot project
    chatbot_batch = StoryBatch(
        id=str(uuid.uuid4()),
        project_id=projects[0].id,
        format=StoryFormat.CLASSIC,
        section_filter=None,
        story_count=8,
        status=StoryBatchStatus.READY,
        created_by="system",
    )
    db.add(chatbot_batch)
    db.flush()

    chatbot_stories = [
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=1,
            format=StoryFormat.CLASSIC,
            title="Customer asks chatbot about order status",
            description="As a customer, I want to ask the chatbot where my order is, so that I can get immediate tracking information without waiting for a human agent.",
            acceptance_criteria=[
                "Given I am on the support chat, when I ask 'Where is my order?', then the chatbot asks for my order number or email",
                "Given I provide valid order information, when the chatbot looks up my order, then it displays current status and estimated delivery date",
                "Given my order is delayed, when status is retrieved, then the chatbot proactively offers tracking link and apology",
            ],
            order=1,
            labels=["mvp", "core-feature", "order-management"],
            size=StorySize.M,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=2,
            format=StoryFormat.CLASSIC,
            title="Customer requests password reset via chatbot",
            description="As a customer, I want to reset my password through the chatbot, so that I don't have to search for the reset link or call support.",
            acceptance_criteria=[
                "Given I say 'I forgot my password', when the chatbot processes the request, then it asks for my registered email",
                "Given I provide a valid email, when the chatbot sends reset link, then I receive it within 60 seconds",
                "Given I provide an unregistered email, when chatbot checks, then it offers to help create an account",
            ],
            order=2,
            labels=["mvp", "authentication", "security"],
            size=StorySize.S,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=3,
            format=StoryFormat.CLASSIC,
            title="Chatbot escalates to human agent when stuck",
            description="As a customer, I want the chatbot to connect me to a human agent when it can't help, so that I don't get stuck in an endless loop.",
            acceptance_criteria=[
                "Given the chatbot confidence is below 80%, when it responds, then it offers to connect to a human agent",
                "Given I type 'speak to human' or similar, when chatbot processes, then it immediately initiates handoff",
                "Given handoff is initiated, when agent becomes available, then full conversation history is visible to agent",
            ],
            order=3,
            labels=["mvp", "escalation", "agent-handoff"],
            size=StorySize.M,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=4,
            format=StoryFormat.CLASSIC,
            title="Customer asks product questions",
            description="As a customer, I want to ask the chatbot about product features and availability, so that I can make informed purchase decisions.",
            acceptance_criteria=[
                "Given I ask about a specific product, when chatbot searches catalog, then it shows product details, price, and availability",
                "Given I ask for product comparison, when chatbot processes, then it shows side-by-side feature comparison",
                "Given product is out of stock, when chatbot responds, then it offers notify-when-available option",
            ],
            order=4,
            labels=["catalog", "product-info"],
            size=StorySize.M,
            priority=StoryPriority.P2,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=5,
            format=StoryFormat.CLASSIC,
            title="Support manager views chatbot analytics",
            description="As a support manager, I want to see chatbot performance metrics, so that I can optimize the automated support experience.",
            acceptance_criteria=[
                "Given I access the analytics dashboard, when I view chatbot metrics, then I see deflection rate, CSAT, and avg response time",
                "Given I select a date range, when metrics load, then data updates to reflect the selected period",
                "Given I click on a failed conversation, when details load, then I see the full transcript and failure reason",
            ],
            order=5,
            labels=["analytics", "admin", "reporting"],
            size=StorySize.L,
            priority=StoryPriority.P2,
            status=StoryStatus.DRAFT,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=6,
            format=StoryFormat.CLASSIC,
            title="Chatbot responds in customer's language",
            description="As an international customer, I want the chatbot to respond in my preferred language, so that I can communicate comfortably.",
            acceptance_criteria=[
                "Given I start typing in Spanish, when chatbot detects language, then it responds in Spanish",
                "Given I switch languages mid-conversation, when chatbot processes, then it adapts to the new language",
                "Given a phrase is ambiguous, when chatbot is unsure, then it asks for language preference",
            ],
            order=6,
            labels=["i18n", "multi-language"],
            size=StorySize.L,
            priority=StoryPriority.P2,
            status=StoryStatus.DRAFT,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=7,
            format=StoryFormat.CLASSIC,
            title="Customer initiates return through chatbot",
            description="As a customer, I want to start a return process through the chatbot, so that I don't have to navigate the website or call support.",
            acceptance_criteria=[
                "Given I request a return, when chatbot verifies order, then it shows return eligibility status",
                "Given item is eligible, when I confirm return, then chatbot generates return label and instructions",
                "Given return window has expired, when chatbot checks, then it explains policy and offers manager escalation",
            ],
            order=7,
            labels=["returns", "order-management"],
            size=StorySize.M,
            priority=StoryPriority.P2,
            status=StoryStatus.DRAFT,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[0].id,
            batch_id=chatbot_batch.id,
            story_number=8,
            format=StoryFormat.CLASSIC,
            title="Chatbot greets returning customers",
            description="As a returning customer, I want the chatbot to recognize me, so that I don't have to provide my information again.",
            acceptance_criteria=[
                "Given I am logged in and start chat, when chatbot initializes, then it greets me by name",
                "Given I have recent orders, when chatbot loads context, then it proactively mentions recent order status",
                "Given I have open support tickets, when chatbot checks, then it asks if I'm following up on existing issue",
            ],
            order=8,
            labels=["personalization", "context"],
            size=StorySize.S,
            priority=StoryPriority.P3,
            status=StoryStatus.DRAFT,
        ),
    ]

    for story in chatbot_stories:
        db.add(story)

    # Story batch for Mobile Banking project
    banking_batch = StoryBatch(
        id=str(uuid.uuid4()),
        project_id=projects[1].id,
        format=StoryFormat.CLASSIC,
        section_filter=None,
        story_count=6,
        status=StoryBatchStatus.READY,
        created_by="system",
    )
    db.add(banking_batch)
    db.flush()

    banking_stories = [
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=1,
            format=StoryFormat.CLASSIC,
            title="User logs in with Face ID",
            description="As a mobile banking user, I want to log in using Face ID, so that I can access my account quickly and securely.",
            acceptance_criteria=[
                "Given Face ID is enabled on device, when I open the app, then biometric prompt appears automatically",
                "Given Face ID authentication succeeds, when verified, then I am taken directly to account dashboard",
                "Given Face ID fails 3 times, when I retry, then app prompts for password fallback",
            ],
            order=1,
            labels=["authentication", "security", "ios"],
            size=StorySize.M,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=2,
            format=StoryFormat.CLASSIC,
            title="User sends money to saved contact",
            description="As a user, I want to send money to a saved recipient with minimal taps, so that transfers are quick and convenient.",
            acceptance_criteria=[
                "Given I select a saved recipient, when I tap their name, then amount entry screen appears with recent amounts",
                "Given I enter an amount and confirm, when transaction processes, then confirmation shows within 3 seconds",
                "Given transfer succeeds, when confirmation shows, then both parties receive push notification",
            ],
            order=2,
            labels=["transfers", "p2p", "core-feature"],
            size=StorySize.M,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=3,
            format=StoryFormat.CLASSIC,
            title="User views pending transactions",
            description="As a user, I want to see pending transactions in my balance, so that I have accurate visibility into my available funds.",
            acceptance_criteria=[
                "Given I view my account balance, when transactions are pending, then balance shows 'Available' vs 'Current' amounts",
                "Given pending transactions exist, when I tap the balance, then I see itemized pending transactions",
                "Given a pending transaction clears, when it posts, then balance updates in real-time",
            ],
            order=3,
            labels=["balance", "transactions", "real-time"],
            size=StorySize.L,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=4,
            format=StoryFormat.CLASSIC,
            title="User freezes debit card",
            description="As a user, I want to instantly freeze my debit card from the app, so that I can prevent fraud if my card is lost or stolen.",
            acceptance_criteria=[
                "Given I navigate to card controls, when I tap freeze, then card is frozen within 5 seconds",
                "Given card is frozen, when a transaction is attempted, then it is declined and I receive alert",
                "Given I unfreeze the card, when I confirm, then card is immediately usable again",
            ],
            order=4,
            labels=["card-controls", "security", "fraud-prevention"],
            size=StorySize.S,
            priority=StoryPriority.P1,
            status=StoryStatus.READY,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=5,
            format=StoryFormat.CLASSIC,
            title="User views spending insights",
            description="As a user, I want to see my spending broken down by category, so that I can understand and manage my finances.",
            acceptance_criteria=[
                "Given I navigate to insights, when data loads, then I see pie chart of spending by category",
                "Given I tap a category, when detail view opens, then I see all transactions in that category",
                "Given I view monthly trends, when I swipe between months, then comparison data is shown",
            ],
            order=5,
            labels=["insights", "analytics", "financial-wellness"],
            size=StorySize.L,
            priority=StoryPriority.P2,
            status=StoryStatus.DRAFT,
        ),
        UserStory(
            id=str(uuid.uuid4()),
            project_id=projects[1].id,
            batch_id=banking_batch.id,
            story_number=6,
            format=StoryFormat.CLASSIC,
            title="User sends money via QR code",
            description="As a user, I want to send money by scanning a QR code, so that I can pay someone without typing their details.",
            acceptance_criteria=[
                "Given I tap 'Scan to Pay', when camera opens, then QR scanner is active with guide overlay",
                "Given I scan valid QR code, when decoded, then recipient name and suggested amount populate",
                "Given I confirm payment, when processed, then both parties see confirmation instantly",
            ],
            order=6,
            labels=["p2p", "qr-code", "payments"],
            size=StorySize.M,
            priority=StoryPriority.P2,
            status=StoryStatus.DRAFT,
        ),
    ]

    for story in banking_stories:
        db.add(story)

    db.commit()
    print("✓ Created user stories for 2 projects")


def main():
    """Main function to seed demo data."""
    print("\n🌱 Seeding demo data...\n")

    db = SessionLocal()
    try:
        # Clear existing data
        clear_existing_data(db)

        # Create demo user
        demo_user = create_demo_user(db)

        # Create projects
        projects = create_projects(db, demo_user.id)

        # Create requirements
        create_all_requirements(db, projects)

        # Create PRDs
        create_prds(db, projects)

        # Create user stories
        create_user_stories(db, projects)

        print("\n✅ Demo data seeded successfully!\n")
        print("Projects created:")
        for i, p in enumerate(projects, 1):
            status = "📦 Archived" if p.archived else "🟢 Active"
            print(f"  {i}. {p.name} ({status})")
        print()

    except Exception as e:
        print(f"\n❌ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
