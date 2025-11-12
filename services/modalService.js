const modalContainer = document.getElementById('modal-container');
let previouslyFocusedElement;

/**
 * Displays a confirmation modal dialog.
 * This function is designed with accessibility in mind, implementing focus trapping
 * and proper ARIA roles.
 * @param {object} options - The options for the modal.
 * @param {string} options.title - The title to display in the modal header.
 * @param {string} options.message - The descriptive message in the modal body.
 * @param {string} [options.confirmText='Confirm'] - The text for the confirm button.
 * @param {string} [options.cancelText='Cancel'] - The text for the cancel button.
 * @returns {Promise<boolean>} A promise that resolves to `true` if confirmed, `false` otherwise.
 */
export function showConfirmationModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
    return new Promise((resolve) => {
        // Save the element that was focused before the modal opened
        previouslyFocusedElement = document.activeElement;

        const modalHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message">
                <div class="modal-header">
                    <h2 id="modal-title">${title}</h2>
                </div>
                <div class="modal-body">
                    <p id="modal-message">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="modal-cancel-btn">${cancelText}</button>
                    <button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
                </div>
            </div>
        `;
        modalContainer.innerHTML = modalHTML;

        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const backdrop = modalContainer.querySelector('.modal-backdrop');
        const modalContent = modalContainer.querySelector('.modal-content');

        // --- Accessibility: Focus Trapping ---
        const focusableElements = modalContent.querySelectorAll('button');
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];

        const close = (value) => {
            modalContainer.innerHTML = '';
            document.removeEventListener('keydown', keydownHandler);
            // Restore focus to the previously focused element
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus();
            }
            resolve(value);
        };

        const keydownHandler = (e) => {
            if (e.key === 'Escape') {
                close(false);
            }
            if (e.key === 'Tab') {
                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstFocusableElement) {
                        e.preventDefault();
                        lastFocusableElement.focus();
                    }
                } else { // Tab
                    if (document.activeElement === lastFocusableElement) {
                        e.preventDefault();
                        firstFocusableElement.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', keydownHandler);

        confirmBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        backdrop.addEventListener('click', () => close(false));

        // Set initial focus on the confirm button for primary action
        confirmBtn.focus();
    });
}