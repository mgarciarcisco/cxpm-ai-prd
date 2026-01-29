import { useEffect, useRef, useCallback } from 'react';
import './Modal.css';

/**
 * Modern Modal Component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Modal content
 * @param {() => void} props.onClose - Close handler
 * @param {string} [props.title] - Modal title
 * @param {string} [props.subtitle] - Optional subtitle below title
 * @param {string} [props.icon] - Optional icon (emoji) for the header
 * @param {string} [props.size] - Modal size: 'default' | 'large'
 * @param {string} [props.variant] - Modal variant: 'default' | 'form'
 */
export function Modal({
  children,
  onClose,
  title,
  subtitle,
  icon,
  size = 'default',
  variant = 'default'
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  // Focus trap - keep focus inside modal
  const handleFocusTrap = useCallback((e) => {
    if (!modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
    // Store currently focused element
    previousActiveElement.current = document.activeElement;

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleFocusTrap);

    // Focus the modal
    if (modalRef.current) {
      const firstFocusable = modalRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        modalRef.current.focus();
      }
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
  }, [handleKeyDown, handleFocusTrap]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const containerClasses = [
    'modal-container',
    size === 'large' && 'modal-container--large',
    variant === 'form' && 'modal-container--form'
  ].filter(Boolean).join(' ');

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className={containerClasses}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
      >
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {(title || icon) && (
          <div className="modal-header">
            {icon && (
              <div className="modal-icon" aria-hidden="true">
                {icon}
              </div>
            )}
            {title && (
              <h2 id="modal-title" className="modal-title">{title}</h2>
            )}
            {subtitle && (
              <p className="modal-subtitle">{subtitle}</p>
            )}
          </div>
        )}

        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
