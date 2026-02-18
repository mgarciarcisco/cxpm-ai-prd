"""Consolidate 9 sections to 5, add speaker and priority to meeting_items.

Revision ID: b3c4d5e6f7a8
Revises: e0a1b2c3d4e5
Create Date: 2026-02-09

Merges the original 9-section taxonomy into 5 consolidated sections:
  problems, user_goals          -> needs_and_goals
  functional_requirements, data_needs -> requirements
  constraints, non_goals        -> scope_and_constraints
  risks_assumptions, open_questions   -> risks_and_questions
  action_items                  -> action_items  (unchanged)

Also adds `speaker` and `priority` columns to meeting_items.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "e0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Old -> new section mapping
SECTION_MAP = {
    "problems": "needs_and_goals",
    "user_goals": "needs_and_goals",
    "functional_requirements": "requirements",
    "data_needs": "requirements",
    "constraints": "scope_and_constraints",
    "non_goals": "scope_and_constraints",
    "risks_assumptions": "risks_and_questions",
    "open_questions": "risks_and_questions",
    # action_items stays as-is
}


def _is_postgres() -> bool:
    """Check if the current database is PostgreSQL."""
    return op.get_bind().dialect.name == "postgresql"


# The 5 new consolidated section values
NEW_SECTION_VALUES = (
    "needs_and_goals",
    "requirements",
    "scope_and_constraints",
    "risks_and_questions",
    "action_items",
)


def upgrade() -> None:
    """Add speaker/priority columns and consolidate sections from 9 to 5."""

    # 1. Add new columns to meeting_items
    op.add_column(
        "meeting_items",
        sa.Column("speaker", sa.Text(), nullable=True),
    )
    op.add_column(
        "meeting_items",
        sa.Column("priority", sa.Text(), nullable=True),
    )

    # 2. Remap section values in both tables.
    #    PostgreSQL uses a strict enum type so we must convert columns to TEXT
    #    first, remap the values, then recreate the enum with the new values.
    if _is_postgres():
        # Convert enum columns to TEXT so we can update freely
        op.execute("ALTER TABLE meeting_items ALTER COLUMN section TYPE TEXT")
        op.execute("ALTER TABLE requirements ALTER COLUMN section TYPE TEXT")

    for old_val, new_val in SECTION_MAP.items():
        op.execute(
            f"UPDATE meeting_items SET section = '{new_val}' "
            f"WHERE section = '{old_val}'"
        )
        op.execute(
            f"UPDATE requirements SET section = '{new_val}' "
            f"WHERE section = '{old_val}'"
        )

    if _is_postgres():
        # Drop the old enum type and create it with the new values
        op.execute("DROP TYPE section")
        enum_vals = ", ".join(f"'{v}'" for v in NEW_SECTION_VALUES)
        op.execute(f"CREATE TYPE section AS ENUM ({enum_vals})")

        # Convert columns back to the enum type
        op.execute(
            "ALTER TABLE meeting_items "
            "ALTER COLUMN section TYPE section USING section::section"
        )
        op.execute(
            "ALTER TABLE requirements "
            "ALTER COLUMN section TYPE section USING section::section"
        )

    # 3. Renumber `order` within merged sections to fix duplicates.
    #    Uses a correlated subquery that counts how many items in the same
    #    (scope_id, section) come before this row.
    op.execute("""
        UPDATE meeting_items SET "order" = (
            SELECT COUNT(*) FROM meeting_items AS mi2
            WHERE mi2.meeting_id = meeting_items.meeting_id
              AND mi2.section = meeting_items.section
              AND (mi2.created_at < meeting_items.created_at
                   OR (mi2.created_at = meeting_items.created_at
                       AND mi2.id < meeting_items.id))
        )
    """)

    op.execute("""
        UPDATE requirements SET "order" = (
            SELECT COUNT(*) FROM requirements AS r2
            WHERE r2.project_id = requirements.project_id
              AND r2.section = requirements.section
              AND (r2.created_at < requirements.created_at
                   OR (r2.created_at = requirements.created_at
                       AND r2.id < requirements.id))
        )
    """)


def downgrade() -> None:
    """Remove speaker and priority columns.

    NOTE: This is a one-way migration for section data. The section value
    consolidation cannot be perfectly reversed because the mapping is
    many-to-one (e.g. both 'problems' and 'user_goals' become
    'needs_and_goals'). The downgrade only removes the new columns and does
    a best-effort reverse mapping (picking the first of each merged pair).
    """
    # Best-effort reverse mapping
    reverse_map = {
        "needs_and_goals": "problems",
        "requirements": "functional_requirements",
        "scope_and_constraints": "constraints",
        "risks_and_questions": "risks_assumptions",
    }

    # Original 9-value enum
    old_enum_values = (
        "problems", "user_goals", "functional_requirements", "data_needs",
        "constraints", "non_goals", "risks_assumptions", "open_questions",
        "action_items",
    )

    if _is_postgres():
        # Convert to TEXT for safe remapping
        op.execute("ALTER TABLE meeting_items ALTER COLUMN section TYPE TEXT")
        op.execute("ALTER TABLE requirements ALTER COLUMN section TYPE TEXT")

    for new_val, old_val in reverse_map.items():
        op.execute(
            f"UPDATE meeting_items SET section = '{old_val}' "
            f"WHERE section = '{new_val}'"
        )
        op.execute(
            f"UPDATE requirements SET section = '{old_val}' "
            f"WHERE section = '{new_val}'"
        )

    if _is_postgres():
        # Recreate the original enum type
        op.execute("DROP TYPE section")
        enum_vals = ", ".join(f"'{v}'" for v in old_enum_values)
        op.execute(f"CREATE TYPE section AS ENUM ({enum_vals})")

        op.execute(
            "ALTER TABLE meeting_items "
            "ALTER COLUMN section TYPE section USING section::section"
        )
        op.execute(
            "ALTER TABLE requirements "
            "ALTER COLUMN section TYPE section USING section::section"
        )

    # Remove added columns
    op.drop_column("meeting_items", "priority")
    op.drop_column("meeting_items", "speaker")
