
/**
 * VFX Service - "The Juice"
 * Handles particle effects, screen shakes, and number animations to make the app feel alive.
 */

// --- CONFETTI ENGINE (Physics-based) ---
let canvas = null;
let ctx = null;
let particles = [];
let animationId = null;

function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none'; // Click through
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 4;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * -10 - 5; // Explosion upwards
        this.gravity = 0.4;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.rotation += this.rotationSpeed;
        
        // Air drag
        this.speedX *= 0.99;
        this.speedY *= 0.99;
        
        // Shrink slowly
        if (this.speedY > 0) { // Only shrink when falling
            this.size -= 0.05;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function animateConfetti() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles = particles.filter(p => p.size > 0 && p.y < canvas.height);
    
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    if (particles.length > 0) {
        animationId = requestAnimationFrame(animateConfetti);
    } else {
        cancelAnimationFrame(animationId);
        animationId = null;
        // Cleanup canvas to save memory if needed, but keeping it DOM-attached is faster
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Triggers a confetti explosion from a specific coordinate.
 * @param {number} x - X screen coordinate (default: center)
 * @param {number} y - Y screen coordinate (default: center)
 */
export function burstConfetti(x, y) {
    initCanvas();
    const originX = x || window.innerWidth / 2;
    const originY = y || window.innerHeight / 2;
    
    for (let i = 0; i < 60; i++) {
        particles.push(new Particle(originX, originY));
    }
    
    if (!animationId) {
        animateConfetti();
    }
}

// --- SCREEN SHAKE ---

/**
 * Shakes an element vigorously.
 * @param {HTMLElement} element - The element to shake.
 */
export function shake(element) {
    if (!element) return;
    
    // Remove class to reset if already shaking
    element.classList.remove('shake-animation');
    
    // Force reflow
    void element.offsetWidth;
    
    element.classList.add('shake-animation');
    
    // Clean up class after animation
    setTimeout(() => {
        element.classList.remove('shake-animation');
    }, 500);
}

// --- NUMBER ROLLING ---

/**
 * Animates a number counting up from start to end.
 * @param {HTMLElement} element - The element displaying the number.
 * @param {number} endValue - The target number.
 * @param {number} duration - Animation duration in ms.
 * @param {string} suffix - Optional suffix like " XP"
 */
export function animateNumber(element, startValue, endValue, duration = 1000, suffix = '') {
    if (!element) return;
    
    // Ensure we are working with numbers
    startValue = parseInt(startValue) || 0;
    endValue = parseInt(endValue) || 0;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function (easeOutExpo)
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const current = Math.floor(ease * (endValue - startValue) + startValue);
        
        // Special case for big numbers
        element.textContent = current.toLocaleString() + suffix;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
