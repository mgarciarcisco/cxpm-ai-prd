import React, { useState, useEffect } from 'react';
import './OfflineIndicator.css';

/**
 * OfflineIndicator component.
 * Shows a banner when the user loses network connectivity.
 * Uses the navigator.onLine API and online/offline events.
 */
function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Briefly show "Back online" message before hiding
      setTimeout(() => {
        setShowBanner(false);
      }, 2000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    // Initial state
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className={`offline-indicator ${isOffline ? 'offline-indicator--offline' : 'offline-indicator--online'}`}
      role="alert"
      aria-live="polite"
    >
      <div className="offline-indicator__content">
        {isOffline ? (
          <>
            <svg
              className="offline-indicator__icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 4L18 16M10 4C12.4 4 14.6 4.9 16.2 6.4M5.5 8.5C6.6 7.5 8 6.8 9.5 6.5M10 10C11.3 10 12.5 10.5 13.4 11.4M7.5 12.5C8.2 11.9 9.1 11.5 10 11.5M10 15C10.5523 15 11 14.5523 11 14C11 13.4477 10.5523 13 10 13C9.44772 13 9 13.4477 9 14C9 14.5523 9.44772 15 10 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="offline-indicator__text">
              You're offline. Some features may not be available.
            </span>
          </>
        ) : (
          <>
            <svg
              className="offline-indicator__icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 10L9 13L14 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="offline-indicator__text">
              You're back online!
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default OfflineIndicator;
