"""Jira service for interacting with Jira API."""

from jira import JIRA

from app.config import settings


class JiraService:
    """Service for managing Jira integrations."""

    def __init__(self):
        """Initialize JiraService with configuration from Settings."""
        self.jira_base_url = settings.JIRA_BASE_URL
        self.jira_api_key = settings.JIRA_API_KEY
        self.jira_user = settings.JIRA_USER

    def _require_credentials(self) -> None:
        """Raise if Jira credentials are not configured."""
        if not self.jira_api_key or not self.jira_user:
            raise ValueError(
                "Jira integration is not configured. Set JIRA_API_KEY and JIRA_USER in the environment."
            )

    def get_projects(self) -> dict:
        """
        Connect to Jira and retrieve all projects.

        Returns:
            dict: Dictionary containing all projects with their details.
                  Format: {
                      "projects": [
                          {
                              "id": "10000",
                              "key": "PROJ",
                              "name": "Project Name",
                              "description": "Project description",
                              "lead": "user@example.com",
                              "project_type_key": "software"
                          },
                          ...
                      ]
                  }
        """
        self._require_credentials()
        # Create Jira client with basic auth
        jira = JIRA(
            server=self.jira_base_url,
            basic_auth=(self.jira_user, self.jira_api_key)
        )

        # Fetch all projects
        projects = jira.projects()

        # Convert projects to dictionary format
        projects_list = []
        for project in projects:
            project_dict = {
                "id": project.id,
                "key": project.key,
                "name": project.name,
                "description": getattr(project, "description", None),
                "lead": getattr(project.lead, "emailAddress", None) if hasattr(project, "lead") else None,
                "project_type_key": getattr(project, "projectTypeKey", None),
            }
            projects_list.append(project_dict)

        return {"projects": projects_list}


def main():
    """Main method for testing JiraService."""
    print("Connecting to Jira...")
    
    # Create JiraService instance
    jira_service = JiraService()
    
    # Get all projects
    result = jira_service.get_projects()
    
    # Display results
    print(f"\nFound {len(result['projects'])} project(s):\n")
    
    for project in result["projects"]:
        print(f"  Key: {project['key']}")
        print(f"  Name: {project['name']}")
        print(f"  ID: {project['id']}")
        print(f"  Lead: {project['lead']}")
        print(f"  Type: {project['project_type_key']}")
        print(f"  Description: {project['description']}")
        print("-" * 50)


if __name__ == "__main__":
    main()
