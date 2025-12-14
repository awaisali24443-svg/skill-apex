
/**
 * Background Service - The Living Neural Network
 * Renders an interactive canvas background.
 */

let canvas, ctx;
let particles = [];
let animationId;
let width, height;
let mouse = { x: null, y: null, radius: 150 };

// Optimized Configuration
const MAX_PARTICLES = window.innerWidth < 600 ? 30 : 60; 
const CONNECTION_DISTANCE = 120;

// Theme colors
let colorNode = 'rgba(79, 70, 229, 0.15)'; 
let colorLine = 'rgba(14, 165, 233, OPACITY)';

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3; // Slower, calmer
        this.vy = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 2 + 1;
        this.baseX = this.x;
        this.baseY = this.y;
    }

    update() {
        // --- MOUSE INTERACTION ---
        if (mouse.x != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distanceSq = dx * dx + dy * dy;
            
            if (distanceSq < mouse.radius * mouse.radius) {
                const distance = Math.sqrt(distanceSq);
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                
                const force = (mouse.radius - distance) / mouse.radius;
                const directionX = forceDirectionX * force * 0.5; 
                const directionY = forceDirectionY * force * 0.5;
                
                this.x += directionX;
                this.y += directionY;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
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
    const count = Math.min(Math.floor(area / 15000), MAX_PARTICLES); 
    
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

        for (let j = i + 1; j < pLength; j++) {
            let p2 = particles[j];
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let distanceSq = dx * dx + dy * dy;

            if (distanceSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
                let distance = Math.sqrt(distanceSq);
                ctx.beginPath();
                let opacity = (1 - (distance / CONNECTION_DISTANCE)) * 0.15;
                ctx.strokeStyle = colorLine.replace('OPACITY', opacity); 
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }

        // Connect to Mouse
        if (mouse.x != null) {
            let dx = mouse.x - p.x;
            let dy = mouse.y - p.y;
            let distanceSq = dx * dx + dy * dy;
            if (distanceSq < 20000) { 
                ctx.beginPath();
                let opacity = (1 - (Math.sqrt(distanceSq) / 150)) * 0.4; 
                ctx.strokeStyle = colorLine.replace('OPACITY', opacity); 
                ctx.lineWidth = 1.5;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
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
        colorNode = 'rgba(79, 70, 229, 0.2)';
        colorLine = 'rgba(14, 165, 233, OPACITY)';
    } else {
        colorNode = 'rgba(255, 255, 255, 0.3)';
        colorLine = 'rgba(255, 255, 255, OPACITY)';
    }
}

// --- VISIBILITY HANDLER ---
function handleVisibilityChange() {
    if (document.hidden) {
        if (animationId) cancelAnimationFrame(animationId);
    } else {
        animate();
    }
}

export function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
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

    document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('mousemove', null);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
}
