
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

// Configuration based on screen size
const MAX_PARTICLES = window.innerWidth < 600 ? 40 : 100;
const CONNECTION_DISTANCE = 120;
const MOUSE_INFLUENCE_SPEED = 0.05;

// Theme colors (will be read from CSS vars)
let colorNode = 'rgba(0,0,0,0.2)'; // Default to dark for light theme visibility
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
        // 1. Mouse Interaction (Magnetic Pull)
        if (mouse.x != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mouse.radius) {
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
    const densityFactor = 8000;
    const count = Math.min(Math.floor(area / densityFactor), 150); 
    
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.update();
        p.draw();

        // Draw Connections
        for (let j = i; j < particles.length; j++) {
            let p2 = particles[j];
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CONNECTION_DISTANCE) {
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
    // Determine if we are in light or dark mode based on background color brightness
    const style = getComputedStyle(document.body);
    const bg = style.backgroundColor;
    
    // Simple brightness check (RGB average)
    let isLight = true;
    if (bg.startsWith('rgb')) {
        const rgb = bg.match(/\d+/g);
        if (rgb) {
            const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
            isLight = brightness > 128;
        }
    } else if (bg.startsWith('#')) {
        // Hex check logic simplified, defaulting to light if unsure
    }

    if (isLight) {
        // Light Mode: Dark Grey Nodes
        colorNode = 'rgba(15, 23, 42, 0.4)'; // Slate 900
        colorLine = 'rgba(15, 23, 42, OPACITY)';
    } else {
        // Dark Mode: White/Light Nodes
        colorNode = 'rgba(255, 255, 255, 0.5)';
        colorLine = 'rgba(255, 255, 255, OPACITY)';
    }
}

export function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
    const resizeObserver = new ResizeObserver(entries => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initParticles();
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
