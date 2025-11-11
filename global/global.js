// --- Card Hover Glow Effect ---
export function initializeCardGlow() {
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

        // Set the data-text attribute for the button glitch effect
        card.querySelectorAll('.btn').forEach(btn => {
             btn.dataset.text = btn.textContent;
        });

        card.dataset.glowEffectAttached = 'true';
    });
}

// The MutationObserver has been removed for performance and stability.
// Each module that loads cards will now call initializeCardGlow() directly.

// Run on initial load for any static cards
document.addEventListener('DOMContentLoaded', () => {
    initializeCardGlow();
    // Add the data-text attribute to all buttons on the page for the glitch effect
    document.querySelectorAll('.btn').forEach(btn => {
        btn.dataset.text = btn.textContent;
    });
});