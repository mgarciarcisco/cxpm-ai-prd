import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

/**
 * Auth provider component that manages authentication state globally.
 * Stores user info, JWT token, and provides login/register/logout methods.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  /**
   * Fetch current user profile using stored token.
   * Returns the user object or null if the token is invalid.
   */
  const fetchUser = useCallback(async (authToken) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status === 401) {
        // Token is invalid or expired — clear it
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        return null;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch user: ${res.status}`);
      }
      const data = await res.json();
      setUser(data);
      return data;
    } catch (err) {
      console.error('AuthContext: failed to fetch user', err);
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // On mount, verify existing token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      fetchUser(storedToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  /**
   * Log in with email and password.
   * Stores the token in localStorage and fetches the user profile.
   */
  const login = useCallback(async (email, password) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'Invalid email or password');
    }

    const data = await res.json();
    const newToken = data.access_token || data.token;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    await fetchUser(newToken);
    return data;
  }, [fetchUser]);

  /**
   * Register a new account.
   * Stores the token in localStorage and fetches the user profile.
   */
  const register = useCallback(async (name, email, password) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'Registration failed');
    }

    const data = await res.json();
    const newToken = data.access_token || data.token;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    await fetchUser(newToken);
    return data;
  }, [fetchUser]);

  /**
   * Log out the current user.
   * Clears the token from localStorage and resets state.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Get the current auth token from localStorage.
   */
  const getToken = useCallback(() => {
    return localStorage.getItem('auth_token');
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication state and actions.
 * Returns { user, token, loading, login, register, logout, getToken }.
 *
 * @example
 * const { user, login, logout } = useAuth();
 * await login('user@example.com', 'password');
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
