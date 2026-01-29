import { useEffect, useState, useCallback } from 'react';
import './Toast.css';

/**
 * Individual toast notification component
 */
export function Toast({ id, message, type = 'error', onDismiss, duration = 5000 }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for exit animation before removing
    setTimeout(() => {
      onDismiss(id);
    }, 200);
  }, [id, onDismiss]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  const iconMap = {
    error: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="13.5" r="1" fill="currentColor"/>
      </svg>
    ),
    success: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L19 18H1L10 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M10 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="15" r="1" fill="currentColor"/>
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M10 9V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="6.5" r="1" fill="currentColor"/>
      </svg>
    ),
  };

  return (
    <div
      className={`toast toast--${type} ${isExiting ? 'toast--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast__icon" aria-hidden="true">
        {iconMap[type]}
      </span>
      <span className="toast__message">{message}</span>
      <button
        type="button"
        className="toast__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/**
 * Container for rendering multiple toast notifications
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

export default Toast;
