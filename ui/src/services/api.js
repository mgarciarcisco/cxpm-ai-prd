/**
 * API service layer with fetch wrapper for consistent HTTP calls
 */

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/**
 * Make a GET request to the API
 * @param {string} endpoint - API endpoint (e.g., '/api/projects')
 * @param {object} [options] - Request options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds (0 to disable)
 * @param {AbortSignal} [options.signal] - AbortSignal for request cancellation
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response or timeout
 */
export async function get(endpoint, options = {}) {
  const { timeout = 30000, signal } = options;
  const controller = new AbortController();
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

  // Combine external signal with timeout signal
  const combinedSignal = signal
    ? (typeof AbortSignal.any === 'function'
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal)
    : controller.signal;

  // If external signal provided, abort our controller when it aborts
  if (signal && typeof AbortSignal.any !== 'function') {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      signal: combinedSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        throw err; // Re-throw if externally aborted (component unmount)
      }
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Make a POST request to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - JSON body to send
 * @param {object} [options] - Request options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds (0 to disable)
 * @param {AbortSignal} [options.signal] - AbortSignal for request cancellation
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response or timeout
 */
export async function post(endpoint, data, options = {}) {
  const { timeout = 30000, signal } = options;
  const controller = new AbortController();
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

  // Combine external signal with timeout signal
  const combinedSignal = signal
    ? (typeof AbortSignal.any === 'function'
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal)
    : controller.signal;

  // If external signal provided, abort our controller when it aborts
  if (signal && typeof AbortSignal.any !== 'function') {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: combinedSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        throw err; // Re-throw if externally aborted (component unmount)
      }
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Make a PUT request to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - JSON body to send
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response
 */
export async function put(endpoint, data) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Make a PATCH request to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - JSON body to send
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response
 */
export async function patch(endpoint, data) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Make a DELETE request to the API
 * @param {string} endpoint - API endpoint
 * @returns {Promise<void>}
 * @throws {Error} - Error with message on non-ok response
 */
export async function del(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  // DELETE typically returns 204 No Content, so no JSON to parse
  if (response.status !== 204) {
    return response.json();
  }
}

// ============================================================
// PRD API Functions
// ============================================================

/**
 * Start PRD generation for a project
 * @param {string} projectId - Project UUID
 * @param {object} options - Generation options
 * @param {string} options.mode - 'draft' or 'detailed'
 * @param {string} [options.created_by] - Optional creator identifier
 * @returns {Promise<object>} - PRD status response with id and status
 */
export async function generatePRD(projectId, options) {
  return post(`/api/projects/${projectId}/prds/generate`, options);
}

/**
 * Get PRD generation status (for polling)
 * @param {string} prdId - PRD UUID
 * @returns {Promise<object>} - Status response with id, status, error_message
 */
export async function getPRDStatus(prdId) {
  return get(`/api/prds/${prdId}/status`);
}

/**
 * Cancel PRD generation
 * @param {string} prdId - PRD UUID
 * @returns {Promise<object>} - Updated status response
 */
export async function cancelPRDGeneration(prdId) {
  return post(`/api/prds/${prdId}/cancel`, {});
}

/**
 * Get a single PRD with all sections
 * @param {string} prdId - PRD UUID
 * @returns {Promise<object>} - Full PRD object with sections
 */
export async function getPRD(prdId) {
  return get(`/api/prds/${prdId}`);
}

/**
 * Update PRD content (title and/or sections)
 * @param {string} prdId - PRD UUID
 * @param {object} data - Update data with title and/or sections
 * @returns {Promise<object>} - Updated PRD object
 */
export async function updatePRD(prdId, data) {
  return put(`/api/prds/${prdId}`, data);
}

/**
 * List PRDs for a project
 * @param {string} projectId - Project UUID
 * @param {object} [options] - Query options
 * @param {number} [options.skip=0] - Pagination offset
 * @param {number} [options.limit=20] - Pagination limit
 * @param {boolean} [options.include_archived=false] - Include archived PRDs
 * @returns {Promise<object>} - Paginated list of PRDs
 */
export async function listPRDs(projectId, options = {}) {
  const params = new URLSearchParams();
  if (options.skip) params.append('skip', options.skip);
  if (options.limit) params.append('limit', options.limit);
  if (options.include_archived) params.append('include_archived', 'true');
  const query = params.toString();
  return get(`/api/projects/${projectId}/prds${query ? `?${query}` : ''}`);
}

/**
 * Soft delete a PRD
 * @param {string} prdId - PRD UUID
 * @returns {Promise<void>}
 */
export async function deletePRD(prdId) {
  return del(`/api/prds/${prdId}`);
}

/**
 * Create a blank PRD for manual writing
 * @param {string} projectId - Project UUID
 * @param {object} [data] - Optional initial data
 * @param {string} [data.title] - Optional PRD title
 * @param {Array} [data.sections] - Optional initial sections
 * @returns {Promise<object>} - Created PRD object
 */
export async function createPRD(projectId, data = {}) {
  return post(`/api/projects/${projectId}/prds`, data);
}

/**
 * Restore a historical PRD version by creating a new version with its content
 * @param {string} prdId - PRD UUID to restore from
 * @returns {Promise<object>} - Newly created PRD object
 */
export async function restorePRD(prdId) {
  return post(`/api/prds/${prdId}/restore`, {});
}

/**
 * Export PRD in specified format
 * @param {string} prdId - PRD UUID
 * @param {string} format - Export format ('markdown' or 'json')
 * @returns {Promise<Blob>} - File blob for download
 */
export async function exportPRD(prdId, format = 'markdown') {
  const response = await fetch(`${BASE_URL}/api/prds/${prdId}/export?format=${format}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed with status ${response.status}`);
  }
  return response.blob();
}

// ============================================================
// User Stories API Functions
// ============================================================

/**
 * Start user story generation for a project
 * @param {string} projectId - Project UUID
 * @param {object} options - Generation options
 * @param {string} options.format - 'classic' or 'job_story'
 * @param {string[]} [options.section_filter] - Optional section names to filter requirements
 * @param {string} [options.created_by] - Optional creator identifier
 * @returns {Promise<object>} - Batch status response with id and status
 */
export async function generateStories(projectId, options) {
  return post(`/api/projects/${projectId}/stories/generate`, options);
}

/**
 * Get batch generation status (for polling)
 * @param {string} batchId - Batch UUID
 * @returns {Promise<object>} - Status response with id, status, story_count, error_message
 */
export async function getBatchStatus(batchId) {
  return get(`/api/stories/batches/${batchId}/status`);
}

/**
 * Cancel story generation batch
 * @param {string} batchId - Batch UUID
 * @returns {Promise<object>} - Updated status response
 */
export async function cancelStoryGeneration(batchId) {
  return post(`/api/stories/batches/${batchId}/cancel`, {});
}

/**
 * List user stories for a project
 * @param {string} projectId - Project UUID
 * @param {object} [options] - Query options
 * @param {number} [options.skip=0] - Pagination offset
 * @param {number} [options.limit=50] - Pagination limit
 * @param {string} [options.batch_id] - Filter by batch ID
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.labels] - Filter by label
 * @returns {Promise<object>} - Paginated list of stories
 */
export async function listStories(projectId, options = {}) {
  const params = new URLSearchParams();
  if (options.skip) params.append('skip', options.skip);
  if (options.limit) params.append('limit', options.limit);
  if (options.batch_id) params.append('batch_id', options.batch_id);
  if (options.status) params.append('status', options.status);
  if (options.labels) params.append('labels', options.labels);
  const query = params.toString();
  return get(`/api/projects/${projectId}/stories${query ? `?${query}` : ''}`);
}

/**
 * Get a single user story
 * @param {string} storyId - Story UUID
 * @returns {Promise<object>} - Full story object
 */
export async function getStory(storyId) {
  return get(`/api/stories/${storyId}`);
}

/**
 * Create a new user story manually
 * @param {string} projectId - Project UUID
 * @param {object} data - Story data (title, description, acceptance_criteria, labels, size, priority, status)
 * @returns {Promise<object>} - Created story object with auto-generated story_id
 */
export async function createStory(projectId, data) {
  return post(`/api/projects/${projectId}/stories`, data);
}

/**
 * Update user story details
 * @param {string} storyId - Story UUID
 * @param {object} data - Update data (title, description, acceptance_criteria, labels, size, status)
 * @returns {Promise<object>} - Updated story object
 */
export async function updateStory(storyId, data) {
  return put(`/api/stories/${storyId}`, data);
}

/**
 * Soft delete a user story
 * @param {string} storyId - Story UUID
 * @returns {Promise<void>}
 */
export async function deleteStory(storyId) {
  return del(`/api/stories/${storyId}`);
}

/**
 * List story generation batches for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<object[]>} - List of batches
 */
export async function listBatches(projectId) {
  return get(`/api/projects/${projectId}/stories/batches`);
}

/**
 * Delete all stories in a batch
 * @param {string} projectId - Project UUID
 * @param {string} batchId - Batch UUID
 * @returns {Promise<void>}
 */
export async function deleteBatch(projectId, batchId) {
  return del(`/api/projects/${projectId}/stories/batch/${batchId}`);
}

/**
 * Reorder stories
 * @param {string} projectId - Project UUID
 * @param {string[]} storyIds - Array of story IDs in desired order
 * @returns {Promise<object>} - Success response
 */
export async function reorderStories(projectId, storyIds) {
  return post(`/api/projects/${projectId}/stories/reorder`, { story_ids: storyIds });
}

/**
 * Export stories in specified format
 * @param {string} projectId - Project UUID
 * @param {string} format - Export format ('markdown', 'csv', or 'json')
 * @param {string} [batchId] - Optional batch ID to export specific batch only
 * @returns {Promise<Blob>} - File blob for download
 */
export async function exportStories(projectId, format = 'markdown', batchId = null) {
  const params = new URLSearchParams();
  params.append('format', format);
  if (batchId) params.append('batch_id', batchId);
  const query = params.toString();
  const response = await fetch(`${BASE_URL}/api/projects/${projectId}/stories/export?${query}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed with status ${response.status}`);
  }
  return response.blob();
}

// ============================================================
// JIRA Epic API Functions
// ============================================================

/**
 * Generate a JIRA Epic from requirements
 * @param {string} requirements - Requirements document text (up to 1GB)
 * @returns {Promise<object>} - Response with epic field containing generated epic
 */
export async function generateJiraEpic(requirements) {
  return post('/api/jira-epic/generate', { requirements });
}
