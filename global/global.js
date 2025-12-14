
/**
 * Initializes the interactive glow effect on all elements with the .card class.
 */
function initCardGlowEffect() {
  document.body.addEventListener('pointermove', (e) => {
    const cards = document.querySelectorAll('.card');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--glow-x', `${x}px`);
      card.style.setProperty('--glow-y', `${y}px`);
    }
  });
}

/**
 * Initializes the "Holographic 3D Tilt" effect.
 * Cards rotate slightly in 3D space based on mouse position.
 */
function init3DTiltEffect() {
    document.addEventListener('mousemove', (e) => {
        // Only apply to specific interactive cards to save performance
        const tiltCards = document.querySelectorAll('.topic-card, .profile-identity-card, .widget-style');
        
        tiltCards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check if mouse is near/on the card
            if (
                e.clientX >= rect.left - 20 && 
                e.clientX <= rect.right + 20 && 
                e.clientY >= rect.top - 20 && 
                e.clientY <= rect.bottom + 20
            ) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Calculate rotation (limit to +/- 10 deg)
                const rotateX = ((y - centerY) / centerY) * -5;
                const rotateY = ((x - centerX) / centerX) * 5;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                card.style.zIndex = '10';
            } else {
                // Reset if mouse moves away
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
                card.style.zIndex = '1';
            }
        });
    });
}

/**
 * Initializes the Glitch Effect on click and the RIPPLE effect.
 */
function initClickEffects() {
    document.addEventListener('click', (e) => {
        // 1. Glitch Effect
        const target = e.target.closest('.btn, .sidebar-link, .level-card, .topic-card');
        if (target) {
            target.classList.add('glitch-click-active');
            setTimeout(() => {
                target.classList.remove('glitch-click-active');
            }, 300);
            
            // 2. Ripple Effect (Material Design Style)
            const circle = document.createElement('span');
            const diameter = Math.max(target.clientWidth, target.clientHeight);
            const radius = diameter / 2;
            
            const rect = target.getBoundingClientRect();
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - rect.left - radius}px`;
            circle.style.top = `${e.clientY - rect.top - radius}px`;
            circle.classList.add('ripple-effect');
            
            // Remove old ripples
            const ripple = target.getElementsByClassName('ripple-effect')[0];
            if (ripple) {
                ripple.remove();
            }
            
            target.appendChild(circle);
        }
    });
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
      initCardGlowEffect();
      initClickEffects();
      // Defer heavy 3D effect slightly
      setTimeout(init3DTiltEffect, 500);
  });
} else {
  initCardGlowEffect();
  initClickEffects();
  setTimeout(init3DTiltEffect, 500);
}
