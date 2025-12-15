
/**
 * Initializes the interactive glow effect on all elements with the .card class.
 * The effect follows the user's mouse pointer, updating CSS custom properties
 * that are used by the card's pseudo-element in global.css.
 */
function initCardGlowEffect() {
  // Use a single listener on the body for performance.
  document.body.addEventListener('pointermove', (e) => {
    // This could be expensive on complex pages, but is acceptable for this app's structure.
    const cards = document.querySelectorAll('.card');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Set the CSS custom properties on the individual card element
      card.style.setProperty('--glow-x', `${x}px`);
      card.style.setProperty('--glow-y', `${y}px`);
    }
  });
}

/**
 * Initializes the Glitch Effect on click.
 * Adds a temporary class to elements when clicked to trigger the chromatic aberration animation.
 */
function initClickGlitchEffect() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.btn, .sidebar-link, .level-card, .topic-card');
        if (target) {
            target.classList.add('glitch-click-active');
            setTimeout(() => {
                target.classList.remove('glitch-click-active');
            }, 300); // Match animation duration
        }
    });
}

/**
 * Initializes 3D Holographic Tilt Effect for premium cards.
 * Targets: .topic-card, .profile-identity-card, .expo-card
 */
function init3DTiltEffect() {
    const tiltSelector = '.topic-card, .profile-identity-card, .expo-card';
    
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll(tiltSelector);
        
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            
            // Check if mouse is near/over the card to save performance
            const isHovering = 
                e.clientX >= rect.left - 50 && 
                e.clientX <= rect.right + 50 &&
                e.clientY >= rect.top - 50 &&
                e.clientY <= rect.bottom + 50;

            if (isHovering) {
                card.classList.add('card-3d-active');
                
                // Calculate rotation (center is 0,0)
                const x = e.clientX - (rect.left + rect.width / 2);
                const y = e.clientY - (rect.top + rect.height / 2);
                
                // Max rotation degrees
                const rotationX = (y / rect.height) * -10; // Invert Y for tilt
                const rotationY = (x / rect.width) * 10;
                
                card.style.transform = `perspective(1000px) rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(1.02)`;
            } else {
                // Reset if mouse moves away
                if (card.classList.contains('card-3d-active')) {
                    card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale(1)`;
                    // Small delay before removing class to allow transition to finish
                    setTimeout(() => card.classList.remove('card-3d-active'), 100);
                }
            }
        });
    });
}

// Run the initialization when the DOM is ready to ensure the body element exists.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
      initCardGlowEffect();
      initClickGlitchEffect();
      init3DTiltEffect();
  });
} else {
  initCardGlowEffect();
  initClickGlitchEffect();
  init3DTiltEffect();
}
