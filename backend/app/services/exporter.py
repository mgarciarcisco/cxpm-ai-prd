"""Exporter service for generating Markdown export of requirements."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Project, Requirement, MeetingRecap
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus


# Section display names for the Markdown output
SECTION_TITLES: dict[Section, str] = {
    Section.problems: "Problems",
    Section.user_goals: "User Goals",
    Section.functional_requirements: "Functional Requirements",
    Section.data_needs: "Data Needs",
    Section.constraints: "Constraints",
    Section.non_goals: "Non-Goals",
    Section.risks_assumptions: "Risks & Assumptions",
    Section.open_questions: "Open Questions",
    Section.action_items: "Action Items",
}

# Section order for consistent output
SECTION_ORDER: list[Section] = [
    Section.problems,
    Section.user_goals,
    Section.functional_requirements,
    Section.data_needs,
    Section.constraints,
    Section.non_goals,
    Section.risks_assumptions,
    Section.open_questions,
    Section.action_items,
]


def export_markdown(project_id: UUID, db: Session) -> str:
    """
    Export all active requirements for a project as a Markdown document.

    Args:
        project_id: The UUID of the project to export.
        db: The database session.

    Returns:
        A Markdown-formatted string containing the requirements document.

    Raises:
        ValueError: If the project is not found.
    """
    # Get the project
    project = db.query(Project).filter(Project.id == str(project_id)).first()
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    # Get all active requirements for the project, ordered by section and order
    requirements = (
        db.query(Requirement)
        .filter(Requirement.project_id == str(project_id), Requirement.is_active == True)
        .order_by(Requirement.section, Requirement.order)
        .all()
    )

    # Group requirements by section
    requirements_by_section: dict[Section, list[Requirement]] = {section: [] for section in SECTION_ORDER}
    for req in requirements:
        requirements_by_section[req.section].append(req)

    # Get all applied meetings for the sources table
    applied_meetings = (
        db.query(MeetingRecap)
        .filter(
            MeetingRecap.project_id == str(project_id),
            MeetingRecap.status == MeetingStatus.applied,
        )
        .order_by(MeetingRecap.meeting_date)
        .all()
    )

    # Build the Markdown document
    lines: list[str] = []

    # Header
    lines.append(f"# {project.name} - Working Requirements")
    lines.append("")
    lines.append(f"*Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC*")
    lines.append("")

    # Sections
    for section in SECTION_ORDER:
        section_title = SECTION_TITLES[section]
        section_requirements = requirements_by_section[section]

        lines.append(f"## {section_title}")
        lines.append("")

        if section_requirements:
            for req in section_requirements:
                lines.append(f"- {req.content}")
        else:
            lines.append("*No items in this section.*")

        lines.append("")

    # Sources table
    lines.append("---")
    lines.append("")
    lines.append("## Sources")
    lines.append("")

    if applied_meetings:
        lines.append("| Meeting | Date |")
        lines.append("|---------|------|")
        for meeting in applied_meetings:
            meeting_date = meeting.meeting_date.strftime("%Y-%m-%d") if meeting.meeting_date else "N/A"
            lines.append(f"| {meeting.title} | {meeting_date} |")
    else:
        lines.append("*No meetings have been applied yet.*")

    lines.append("")

    return "\n".join(lines)
