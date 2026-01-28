/**
 * Download utilities for Quick Convert feature.
 * Provides reusable functions to download requirements, PRDs, stories, and mockups.
 */

// Section metadata for requirements formatting
const SECTION_CONFIG = {
  problems: { label: 'Problems' },
  user_goals: { label: 'User Goals' },
  functional_requirements: { label: 'Functional Requirements' },
  data_needs: { label: 'Data Needs' },
  constraints: { label: 'Constraints' },
  non_goals: { label: 'Non-Goals' },
  risks_assumptions: { label: 'Risks & Assumptions' },
  open_questions: { label: 'Open Questions' },
  action_items: { label: 'Action Items' },
};

/**
 * Triggers browser save dialog to download a file.
 * @param {Blob} blob - The file content as a Blob
 * @param {string} filename - The filename for the download
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a timestamp-based filename.
 * @param {string} baseName - The base name for the file (e.g., 'requirements')
 * @param {string} extension - The file extension (e.g., 'json', 'md')
 * @returns {string} The formatted filename
 */
function generateFilename(baseName, extension) {
  const date = new Date().toISOString().split('T')[0];
  return `${baseName}-${date}.${extension}`;
}

// =============================================================================
// REQUIREMENTS DOWNLOADS
// =============================================================================

/**
 * Downloads requirements as a JSON file.
 * @param {Object} requirements - Requirements data object with sections as keys
 *   Format: { section_name: [{ id, content, selected }] }
 * @param {string} [filename] - Optional custom filename
 */
export function downloadRequirementsAsJSON(requirements, filename) {
  const dataStr = JSON.stringify(requirements, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(blob, filename || generateFilename('requirements', 'json'));
}

/**
 * Downloads requirements as a Markdown file.
 * @param {Object} requirements - Requirements data object with sections as keys
 *   Format: { section_name: [{ id, content, selected }] }
 * @param {string} [filename] - Optional custom filename
 */
export function downloadRequirementsAsMarkdown(requirements, filename) {
  const markdown = Object.entries(requirements)
    .map(([section, items]) => {
      const sectionLabel = SECTION_CONFIG[section]?.label || section;
      const itemsText = items.map(item => `- ${item.content}`).join('\n');
      return `## ${sectionLabel}\n\n${itemsText}`;
    })
    .join('\n\n');

  const content = `# Extracted Requirements\n\n${markdown}`;
  const blob = new Blob([content], { type: 'text/markdown' });
  triggerDownload(blob, filename || generateFilename('requirements', 'md'));
}

// =============================================================================
// PRD DOWNLOADS
// =============================================================================

/**
 * Downloads PRD as a Markdown file.
 * @param {string} markdown - The PRD content in Markdown format
 * @param {string} [filename] - Optional custom filename
 */
export function downloadPRDAsMarkdown(markdown, filename) {
  if (!markdown) return;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  triggerDownload(blob, filename || generateFilename('PRD', 'md'));
}

// =============================================================================
// USER STORIES DOWNLOADS
// =============================================================================

/**
 * Downloads user stories as a JSON file.
 * @param {Array} stories - Array of story objects
 *   Format: [{ story_id, title, description, acceptance_criteria, size, priority, labels }]
 * @param {string} [filename] - Optional custom filename
 */
export function downloadStoriesAsJSON(stories, filename) {
  // Format stories for export (clean up internal fields)
  const downloadData = stories.map(story => ({
    id: story.story_id,
    title: story.title,
    description: story.description,
    acceptance_criteria: story.acceptance_criteria || [],
    size: story.size,
    priority: story.priority,
    labels: story.labels || [],
  }));

  const dataStr = JSON.stringify(downloadData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(blob, filename || generateFilename('user-stories', 'json'));
}

/**
 * Downloads user stories as a Markdown file.
 * @param {Array} stories - Array of story objects
 *   Format: [{ story_id, title, description, acceptance_criteria, size, priority, labels }]
 * @param {string} [filename] - Optional custom filename
 */
export function downloadStoriesAsMarkdown(stories, filename) {
  const markdown = stories.map(story => {
    let content = `## ${story.story_id}: ${story.title}\n\n`;
    content += `${story.description}\n\n`;

    // Add metadata badges if present
    const badges = [];
    if (story.size) badges.push(`**Size:** ${story.size.toUpperCase()}`);
    if (story.priority) badges.push(`**Priority:** ${story.priority}`);
    if (badges.length > 0) {
      content += `${badges.join(' | ')}\n\n`;
    }

    // Add acceptance criteria if present
    if (story.acceptance_criteria?.length > 0) {
      content += `### Acceptance Criteria\n\n`;
      story.acceptance_criteria.forEach(criterion => {
        content += `- [ ] ${criterion}\n`;
      });
      content += '\n';
    }

    // Add labels if present
    if (story.labels?.length > 0) {
      content += `**Labels:** ${story.labels.join(', ')}\n`;
    }

    return content;
  }).join('\n---\n\n');

  const fullContent = `# User Stories\n\n${markdown}`;
  const blob = new Blob([fullContent], { type: 'text/markdown' });
  triggerDownload(blob, filename || generateFilename('user-stories', 'md'));
}

// =============================================================================
// MOCKUPS DOWNLOADS
// =============================================================================

/**
 * Downloads an image from a URL or data URL as a PNG file.
 * @param {string} imageUrl - The image URL or data URL
 * @param {string} [filename] - Optional custom filename
 */
export async function downloadMockupAsPNG(imageUrl, filename) {
  try {
    let blob;

    if (imageUrl.startsWith('data:')) {
      // Convert data URL to blob
      const response = await fetch(imageUrl);
      blob = await response.blob();
    } else {
      // Fetch image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      blob = await response.blob();
    }

    triggerDownload(blob, filename || generateFilename('mockup', 'png'));
  } catch (error) {
    console.error('Failed to download mockup:', error);
    throw error;
  }
}

/**
 * Downloads a canvas element as a PNG file.
 * @param {HTMLCanvasElement} canvas - The canvas element to download
 * @param {string} [filename] - Optional custom filename
 */
export function downloadCanvasAsPNG(canvas, filename) {
  canvas.toBlob((blob) => {
    if (blob) {
      triggerDownload(blob, filename || generateFilename('mockup', 'png'));
    }
  }, 'image/png');
}

// =============================================================================
// GENERIC/UTILITY DOWNLOADS
// =============================================================================

/**
 * Downloads text content as a file.
 * @param {string} content - The text content to download
 * @param {string} filename - The filename with extension
 * @param {string} [mimeType='text/plain'] - The MIME type of the file
 */
export function downloadTextFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  triggerDownload(blob, filename);
}

/**
 * Downloads JSON data as a file.
 * @param {Object|Array} data - The data to download as JSON
 * @param {string} filename - The filename (should end in .json)
 */
export function downloadJSON(data, filename) {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  triggerDownload(blob, filename);
}
