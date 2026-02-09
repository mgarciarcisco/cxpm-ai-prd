/**
 * API service layer with fetch wrapper for consistent HTTP calls
 */

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/**
 * Get auth headers for authenticated requests
 */
function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Handle 401 responses by redirecting to login
 */
function handle401(response) {
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }
}

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
      headers: { ...getAuthHeaders() },
      signal: combinedSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    handle401(response);

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
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
      signal: combinedSignal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    handle401(response);

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
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  handle401(response);
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
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  handle401(response);
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
    headers: { ...getAuthHeaders() },
  });
  handle401(response);
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
// JIRA Epic API Functions
// ============================================================

/**
 * Generate a JIRA Epic from requirements
 * @param {string} requirements - Requirements document text (up to 1GB)
 * @returns {Promise<object>} - Response with epic field containing generated epic
 */
export async function generateJiraEpic(requirements) {
  // Use 6 minute timeout (360 seconds) to match backend timeout of 5 minutes + buffer
  return post('/api/jira-epic/generate', { requirements }, { timeout: 360000 });
}

/**
 * Save JIRA stories to the database
 * @param {string} projectId - Project UUID
 * @param {Array} epics - Array of epic objects to save
 * @returns {Promise<object>} - Response with saved count and saved stories
 */
export async function saveJiraStories(projectId, epics) {
  return post('/api/jira-stories/save', { project_id: projectId, epics });
}

/**
 * List JIRA stories for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} - Array of JIRA stories
 */
export async function listJiraStories(projectId) {
  return get(`/api/jira-stories/project/${projectId}`);
}

/**
 * Delete all JIRA stories for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<object>} - Response with deleted count
 */
export async function deleteJiraStories(projectId) {
  return del(`/api/jira-stories/project/${projectId}`);
}
