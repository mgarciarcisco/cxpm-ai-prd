/**
 * API service layer with fetch wrapper for consistent HTTP calls
 */

// In production (nginx), use relative URLs which get proxied to backend
// In development, use localhost:8000 directly
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/**
 * Make a GET request to the API
 * @param {string} endpoint - API endpoint (e.g., '/api/projects')
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response
 */
export async function get(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Make a POST request to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - JSON body to send
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - Error with message on non-ok response
 */
export async function post(endpoint, data) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
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
