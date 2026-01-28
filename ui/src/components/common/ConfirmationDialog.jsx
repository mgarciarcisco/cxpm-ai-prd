import { useState, useEffect, useRef, useCallback } from 'react';
import './ConfirmationDialog.css';

/**
 * Reusable confirmation dialog component
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {function} props.onClose - Callback when dialog is closed/cancelled
 * @param {function} props.onConfirm - Callback when action is confirmed
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message/description
 * @param {string} [props.confirmLabel='Confirm'] - Label for confirm button
 * @param {string} [props.cancelLabel='Cancel'] - Label for cancel button
 * @param {string} [props.variant='warning'] - Dialog variant: 'warning' or 'danger'
 * @param {string} [props.confirmText] - Text user must type to confirm (for destructive actions)
 * @param {boolean} [props.loading=false] - Whether confirm action is in progress
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  confirmText,
  loading = false,
}) {
  const [typedText, setTypedText] = useState('');
  const dialogRef = useRef(null);
  const previousActiveElement = useRef(null);
  const inputRef = useRef(null);

  const requiresTextConfirmation = Boolean(confirmText);
  const isConfirmEnabled = requiresTextConfirmation
    ? typedText === confirmText
    : true;

  // Reset typed text when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  // Handle ESC key press
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    },
    [onClose, loading]
  );

  // Focus trap - keep focus inside dialog
  const handleFocusTrap = useCallback((e) => {
    if (!dialogRef.current) return;

    const focusableElements = dialogRef.current.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement;

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleFocusTrap);

    // Focus the input if type-to-confirm, otherwise focus the dialog
    const focusTarget = requiresTextConfirmation
      ? inputRef.current
      : dialogRef.current?.querySelector(
          'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );

    if (focusTarget) {
      // Small delay to ensure dialog is rendered
      requestAnimationFrame(() => {
        focusTarget.focus();
      });
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = '';

      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown, handleFocusTrap, requiresTextConfirmation]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (isConfirmEnabled && !loading) {
      onConfirm();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleConfirm();
  };

  if (!isOpen) {
    return null;
  }

  const variantClass = `confirmation-dialog--${variant}`;

  return (
    <div
      className="confirmation-dialog__backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={`confirmation-dialog ${variantClass}`}
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-message"
        tabIndex={-1}
      >
        <div className="confirmation-dialog__icon">
          {variant === 'danger' ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>

        <h2 id="confirmation-dialog-title" className="confirmation-dialog__title">
          {title}
        </h2>

        <p id="confirmation-dialog-message" className="confirmation-dialog__message">
          {message}
        </p>

        {requiresTextConfirmation && (
          <form onSubmit={handleSubmit} className="confirmation-dialog__form">
            <label
              htmlFor="confirmation-input"
              className="confirmation-dialog__label"
            >
              Type <strong>{confirmText}</strong> to confirm
            </label>
            <input
              ref={inputRef}
              id="confirmation-input"
              type="text"
              className="confirmation-dialog__input"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={confirmText}
              disabled={loading}
              autoComplete="off"
              spellCheck="false"
            />
          </form>
        )}

        <div className="confirmation-dialog__actions">
          <button
            type="button"
            className="confirmation-dialog__cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirmation-dialog__confirm-btn confirmation-dialog__confirm-btn--${variant}`}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || loading}
          >
            {loading ? (
              <>
                <svg
                  className="confirmation-dialog__spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    strokeDasharray="32"
                    strokeDashoffset="12"
                  />
                </svg>
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
