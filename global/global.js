// --- Card Hover Glow Effect ---
function initializeCardGlow() {
    // This function can be called multiple times, so we use querySelectorAll to get all current cards
    const cards = document.querySelectorAll('.card, .dashboard-card, .category-card, .topic-item, .review-item, .saved-question-item');
    cards.forEach(card => {
        // Check if the listener has already been added to avoid duplicates
        if (card.dataset.glowEffectAttached) return;

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
        card.dataset.glowEffectAttached = 'true';
    });
}

// Use a MutationObserver to apply the effect to cards loaded dynamically
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // A new module might have been loaded, re-run the initialization
            initializeCardGlow();
        }
    }
});

const appElement = document.getElementById('app');
if (appElement) {
    observer.observe(appElement, { childList: true, subtree: true });
}

// Run on initial load
document.addEventListener('DOMContentLoaded', initializeCardGlow);