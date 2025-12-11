
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
let colorNode = 'rgba(255,255,255,0.5)';
let colorLine = 'rgba(255,255,255,0.05)';

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
    // Adjust particle count based on area to prevent overcrowding on huge screens
    // or emptiness on small ones.
    const area = width * height;
    const densityFactor = 8000; // Roughly one particle per 8000px²
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
                // Opacity based on distance (fade out as they get further)
                let opacity = 1 - (distance / CONNECTION_DISTANCE);
                ctx.strokeStyle = colorLine.replace('OPACITY', opacity * 0.4); // Inject dynamic opacity
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
    // Read current theme variables to ensure background matches light/dark mode
    const style = getComputedStyle(document.body);
    
    // Convert generic CSS var to RGBA for canvas manipulation if needed, 
    // or just store the base string.
    // We assume the theme sets a primary text color we can use for nodes.
    const textColor = style.getPropertyValue('--color-text-secondary').trim();
    
    // Parse hex or rgb to set up our RGBA strings
    // Simplified: Just use the variable for nodes, and a low-opacity version for lines
    // Hack: We'll construct a valid color string assuming standard CSS formats
    
    // For visual flair, let's use the Primary Color for nodes but very faint
    const primary = style.getPropertyValue('--color-primary').trim();
    
    // Use a placeholder for opacity replacement
    if (primary.startsWith('#')) {
        // Hex to RGB
        let c = primary.substring(1).split('');
        if(c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x'+c.join('');
        const r = (c>>16)&255, g = (c>>8)&255, b = c&255;
        colorNode = `rgba(${r}, ${g}, ${b}, 0.6)`;
        colorLine = `rgba(${r}, ${g}, ${b}, OPACITY)`;
    } else {
        // Fallback or if already RGB
        colorNode = 'rgba(150, 150, 150, 0.5)';
        colorLine = 'rgba(150, 150, 150, OPACITY)';
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
    
    // Initial Size
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    updateThemeColors();
    initParticles();
    animate();

    // Event Listeners
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });
    
    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Listen for theme changes
    window.addEventListener('settings-changed', () => {
        setTimeout(updateThemeColors, 100); // Small delay to let CSS apply
    });
}

export function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('mousemove', null);
}
