import { useEffect, useState, useCallback, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Hook to warn users before navigating away when they have unsaved work.
 * Handles both browser beforeunload (tab close, refresh) and in-app navigation.
 *
 * @param {object} options
 * @param {boolean} options.hasUnsavedChanges - Whether there are unsaved changes
 * @param {string} [options.message] - Custom warning message for in-app dialog
 * @returns {object} - { showDialog, confirmNavigation, cancelNavigation, pendingLocation }
 */
export function useNavigationWarning({
  hasUnsavedChanges,
  message = 'You have unsaved changes. Are you sure you want to leave?',
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const blockerRef = useRef(null);

  // Use react-router's useBlocker for in-app navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Store blocker ref for access in callbacks
  blockerRef.current = blocker;

  // Handle browser beforeunload event (tab close, refresh, external navigation)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but require returnValue to be set
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  // Handle in-app navigation blocking
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setPendingLocation(blocker.location);
      setShowDialog(true);
    }
  }, [blocker.state, blocker.location]);

  // Confirm navigation (proceed despite unsaved changes)
  const confirmNavigation = useCallback(() => {
    if (blockerRef.current?.proceed) {
      blockerRef.current.proceed();
    }
    setShowDialog(false);
    setPendingLocation(null);
  }, []);

  // Cancel navigation (stay on current page)
  const cancelNavigation = useCallback(() => {
    if (blockerRef.current?.reset) {
      blockerRef.current.reset();
    }
    setShowDialog(false);
    setPendingLocation(null);
  }, []);

  return {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    pendingLocation,
    message,
  };
}

export default useNavigationWarning;
