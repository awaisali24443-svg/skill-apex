
/**
 * Initializes the "Holographic 3D Tilt" & "Sheen" effect.
 * Cards rotate slightly in 3D space based on mouse position AND update sheen coordinates.
 */
function init3DTiltEffect() {
    document.addEventListener('mousemove', (e) => {
        // Apply to specific interactive cards
        const tiltCards = document.querySelectorAll('.topic-card, .profile-identity-card, .widget-style, .achievement-card, .level-card:not(.locked)');
        
        tiltCards.forEach(card => {
            const rect = card.getBoundingClientRect();
            
            // Check if mouse is near/on the card
            // Expanded buffer slightly for smoother entry
            const buffer = 40;
            if (
                e.clientX >= rect.left - buffer && 
                e.clientX <= rect.right + buffer && 
                e.clientY >= rect.top - buffer && 
                e.clientY <= rect.bottom + buffer
            ) {
                // 1. Calculate Holographic Sheen Coordinates (Relative % for CSS)
                // We clamp values to 0-100% so the gradient doesn't fly off too far
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const percentX = (x / rect.width) * 100;
                const percentY = (y / rect.height) * 100;
                
                card.style.setProperty('--mouse-x', `${percentX}%`);
                card.style.setProperty('--mouse-y', `${percentY}%`);

                // 2. Calculate 3D Rotation
                // Center origin
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Calculate rotation (limit to +/- 8 deg for subtlety)
                const rotateX = ((y - centerY) / centerY) * -8;
                const rotateY = ((x - centerX) / centerX) * 8;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                card.style.zIndex = '10'; // Bring to front
            } else {
                // Reset
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
                card.style.zIndex = '1';
                
                // Optional: Fade out sheen slowly by setting coordinates to center or out of bounds? 
                // CSS handles opacity transition, so just leaving vars is fine.
            }
        });
    });
}

/**
 * Initializes the Glitch Effect on click and the RIPPLE effect.
 */
function initClickEffects() {
    document.addEventListener('click', (e) => {
        // 1. Glitch Effect on click
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
      initClickEffects();
      // Defer heavy 3D effect slightly to allow layout to settle
      setTimeout(init3DTiltEffect, 500);
  });
} else {
  initClickEffects();
  setTimeout(init3DTiltEffect, 500);
}
