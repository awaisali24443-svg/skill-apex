const toastContainer = document.getElementById('toast-container');

/**
 * Displays a short-lived notification message (toast).
 * Toasts are announced by screen readers for accessibility.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'error'} [type='info'] - The type of toast, affecting its style.
 * @param {number} [duration=3000] - How long the toast appears in milliseconds.
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Accessibility attributes to make screen readers announce the toast
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}