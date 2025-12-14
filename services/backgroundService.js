
/**
 * Background Service - The Living Neural Network
 * Renders an interactive canvas background that responds to mouse movement
 * and theme changes.
 */

let canvas, ctx;
let particles = [];
let animationId;
let width, height;
let mouse = { x: null, y: null, radius: 150 };

// Optimized Configuration
// Reduced count for faster rendering performance
const MAX_PARTICLES = window.innerWidth < 600 ? 30 : 70; 
const CONNECTION_DISTANCE = 110;
const MOUSE_INFLUENCE_SPEED = 0.05;

// Theme colors (will be read from CSS vars)
let colorNode = 'rgba(0,0,0,0.2)'; 
let colorLine = 'rgba(0,0,0,0.05)';

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5; // Velocity X
        this.vy = (Math.random() - 0.5) * 0.5; // Velocity Y
        this.size = Math.random() * 2 + 1;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 30) + 1;
    }

    update() {
        // 1. Mouse Interaction (Magnetic Pull) - Optimized: Only check if mouse moved
        if (mouse.x != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            // Avoid heavy SQRT every frame if possible, but needed for circle distance
            let distanceSq = dx * dx + dy * dy;
            
            if (distanceSq < mouse.radius * mouse.radius) {
                let distance = Math.sqrt(distanceSq);
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (mouse.radius - distance) / mouse.radius;
                const directionX = forceDirectionX * force * this.density;
                const directionY = forceDirectionY * force * this.density;
                
                this.x += directionX * MOUSE_INFLUENCE_SPEED;
                this.y += directionY * MOUSE_INFLUENCE_SPEED;
            }
        }

        // 2. Natural Movement
        this.x += this.vx;
        this.y += this.vy;

        // 3. Boundary Check (Bounce)
        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = colorNode;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    const area = width * height;
    const densityFactor = 10000; // Increased divider -> fewer particles
    const count = Math.min(Math.floor(area / densityFactor), MAX_PARTICLES); 
    
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    const pLength = particles.length;
    for (let i = 0; i < pLength; i++) {
        let p = particles[i];
        p.update();
        p.draw();

        // Draw Connections
        // Optimization: Only check half the matrix to avoid double drawing lines
        for (let j = i + 1; j < pLength; j++) {
            let p2 = particles[j];
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let distanceSq = dx * dx + dy * dy;

            if (distanceSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
                let distance = Math.sqrt(distanceSq);
                ctx.beginPath();
                let opacity = 1 - (distance / CONNECTION_DISTANCE);
                ctx.strokeStyle = colorLine.replace('OPACITY', opacity * 0.4); 
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }
    
    animationId = requestAnimationFrame(animate);
}

function updateThemeColors() {
    const style = getComputedStyle(document.body);
    const bg = style.backgroundColor;
    
    let isLight = true;
    if (bg.startsWith('rgb')) {
        const rgb = bg.match(/\d+/g);
        if (rgb) {
            const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
            isLight = brightness > 128;
        }
    }

    if (isLight) {
        colorNode = 'rgba(15, 23, 42, 0.4)';
        colorLine = 'rgba(15, 23, 42, OPACITY)';
    } else {
        colorNode = 'rgba(255, 255, 255, 0.5)';
        colorLine = 'rgba(255, 255, 255, OPACITY)';
    }
}

export function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
    // Debounced Resize
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(entries => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initParticles();
        }, 200);
    });
    resizeObserver.observe(document.body);
    
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    updateThemeColors();
    initParticles();
    animate();

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });
    
    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('settings-changed', () => {
        setTimeout(updateThemeColors, 100); 
    });
}

export function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('mousemove', null);
}
