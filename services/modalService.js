
const modalContainer = document.getElementById('modal-container');
let previouslyFocusedElement;

/**
 * Displays a confirmation modal dialog.
 * This function is designed with accessibility in mind, implementing focus trapping
 * and proper ARIA roles.
 * @param {object} options - The options for the modal.
 * @param {string} options.title - The title to display in the modal header.
 * @param {string} options.message - The descriptive message in the modal body. Can be an HTML string.
 * @param {string} [options.confirmText='Confirm'] - The text for the confirm button.
 * @param {string} [options.cancelText='Cancel'] - The text for the cancel button.
 * @param {boolean} [options.danger=false] - If true, the confirm button will be styled as a danger button.
 * @returns {Promise<boolean>} A promise that resolves to `true` if confirmed, `false` otherwise.
 */
export function showConfirmationModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
        // Save the element that was focused before the modal opened
        previouslyFocusedElement = document.activeElement;

        const confirmButtonClass = danger ? 'btn btn-danger' : 'btn btn-primary';

        // Nest content INSIDE backdrop to match CSS flex centering and z-index stacking
        const modalHTML = `
            <div class="modal-backdrop">
                <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message">
                    <div class="modal-header">
                        <h2 id="modal-title">${title}</h2>
                    </div>
                    <div class="modal-body">
                        <div id="modal-message">${message}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" id="modal-cancel-btn">${cancelText}</button>
                        <button class="${confirmButtonClass}" id="modal-confirm-btn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        modalContainer.innerHTML = modalHTML;
        modalContainer.style.display = 'block';

        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const backdrop = modalContainer.querySelector('.modal-backdrop');
        const modalContent = modalContainer.querySelector('.modal-content');

        function closeModal(value) {
            modalContainer.innerHTML = '';
            modalContainer.style.display = 'none';
            // Restore focus to the element that had it before the modal opened
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus();
            }
            document.removeEventListener('keydown', handleKeyDown);
            resolve(value);
        }
        
        confirmBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));
        
        // Close only if clicking the backdrop itself, not the content bubbling up
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal(false);
            }
        });

        // --- Accessibility: Focus Trapping ---
        const focusableElements = modalContent.querySelectorAll('button');
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];

        // Focus the first interactive element
        if (firstFocusableElement) firstFocusableElement.focus();

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                closeModal(false);
            }
            if (e.key === 'Tab') {
                if (e.shiftKey) { // Shift+Tab
                    if (document.activeElement === firstFocusableElement) {
                        lastFocusableElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastFocusableElement) {
                        firstFocusableElement.focus();
                        e.preventDefault();
                    }
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
    });
}
