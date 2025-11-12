/**
 * Initializes an interactive glow effect for card elements that follows the mouse.
 * This function should be called by each module after its content,
 * containing `.card` elements, has been added to the DOM.
 * @param {HTMLElement} [container=document] - The parent element to query for cards. Defaults to `document`.
 */
export function initializeCardGlow(container = document) {
    const cards = container.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--glow-x', `${x}px`);
            card.style.setProperty('--glow-y', `${y}px`);
        });
    });
}