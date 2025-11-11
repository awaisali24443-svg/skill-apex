// services/toastService.js

const toastContainer = document.getElementById('toast-container');

/**
 * Displays a toast notification.
 * @param {string} message The message to display.
 * @param {number} [duration=3000] The duration in milliseconds for the toast to be visible.
 */
function show(message, duration = 3000) {
    if (!toastContainer) {
        console.error('Toast container not found in the DOM.');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        // The animation handles the fade-out, then we remove the element.
        toast.remove();
    }, duration);
}

export const toastService = {
    show,
};