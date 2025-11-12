const modalContainer = document.getElementById('modal-container');

export function showConfirmationModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
    return new Promise((resolve) => {
        const modalHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
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

        const close = (value) => {
            modalContainer.innerHTML = '';
            resolve(value);
        };

        confirmBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        backdrop.addEventListener('click', () => close(false));
    });
}
