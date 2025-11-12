let canvas, ctx, particles, animationFrameId;

const PARTICLE_CONFIG = {
    count: 80,
    speed: 0.3,
    minRadius: 1,
    maxRadius: 3,
    lineDistance: 150,
};

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * PARTICLE_CONFIG.speed;
        this.vy = (Math.random() - 0.5) * PARTICLE_CONFIG.speed;
        this.radius = PARTICLE_CONFIG.minRadius + Math.random() * (PARTICLE_CONFIG.maxRadius - PARTICLE_CONFIG.minRadius);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 184, 212, 0.5)'; // Use theme primary color
        ctx.fill();
    }
}

function createParticles() {
    particles = [];
    const particleCount = (window.innerWidth * window.innerHeight) / 20000;
    PARTICLE_CONFIG.count = Math.min(100, Math.floor(particleCount));

    for (let i = 0; i < PARTICLE_CONFIG.count; i++) {
        particles.push(new Particle());
    }
}

function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PARTICLE_CONFIG.lineDistance) {
                const opacity = 1 - (distance / PARTICLE_CONFIG.lineDistance);
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(0, 184, 212, ${opacity * 0.3})`;
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    connectParticles();
    animationFrameId = requestAnimationFrame(animate);
}

function handleResize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createParticles(); // Re-create particles for new screen size
}

export function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) {
        console.error('Particle canvas not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    
    handleResize(); // Set initial size and particles
    animate();

    window.addEventListener('resize', handleResize);
}

export function destroy() {
    if(animationFrameId) {
       cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener('resize', handleResize);
}