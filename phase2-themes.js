

/**
 * PHASE 2: VISUAL REVOLUTION ENGINE
 */
(function() {
    const THEMES = [
        { id: 'dark-cyber', name: 'Dark Cyber', color: '#38bdf8' },
        { id: 'light-cyber', name: 'Light Cyber', color: '#0ea5e9' },
        { id: 'matrix', name: 'Matrix', color: '#00ff41' },
        { id: 'cyberpunk', name: 'Cyberpunk', color: '#fcee0a' },
        { id: 'synthwave', name: 'Synthwave', color: '#ff71ce' },
        { id: 'aurora', name: 'Aurora', color: '#00ff9d' },
        { id: 'obsidian', name: 'Obsidian', color: '#ff5252' },
        { id: 'hacker', name: 'Terminal', color: '#33ff00' },
        { id: 'quantum', name: 'Quantum', color: '#7df9ff' },
        { id: 'neural', name: 'Neural', color: '#e94560' },
        { id: 'cloud', name: 'Cloud Sky', color: '#87ceeb' },
        { id: 'eco', name: 'Eco', color: '#4caf50' },
        { id: 'spatial', name: 'Spatial', color: '#74b9ff' },
        { id: 'biotech', name: 'Biotech', color: '#2aa198' },
        { id: 'light-solar', name: 'Solar', color: '#f97316' },
        { id: 'ocean', name: 'Ocean', color: '#00bcd4' },
        { id: 'magma', name: 'Magma', color: '#ff5722' },
        { id: 'tokyo', name: 'Midnight Tokyo', color: '#f50057' }
    ];

    function init() {
        renderOrb();
        renderModal();
        const saved = localStorage.getItem('kt_theme') || 'dark-cyber';
        applyTheme(saved);
        
        // Listen for settings changes to toggle particles on/off
        window.addEventListener('settings-changed', (e) => {
            const config = e.detail;
            if (config.animationIntensity === 'off') {
                destroyParticles();
            } else {
                const currentTheme = localStorage.getItem('kt_theme') || 'dark-cyber';
                initParticles(currentTheme);
            }
        });
    }

    function renderOrb() {
        const orb = document.createElement('div');
        orb.id = 'theme-orb';
        orb.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z"></path><path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z"></path></svg>`;
        orb.onclick = () => document.getElementById('theme-modal').classList.add('active');
        document.body.appendChild(orb);
    }

    function renderModal() {
        const modal = document.createElement('div');
        modal.id = 'theme-modal';
        modal.className = 'theme-modal';
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <h2>Select Reality</h2>
                <button class="btn" onclick="document.getElementById('theme-modal').classList.remove('active')">Close</button>
            </div>
            <div class="theme-grid"></div>
        `;
        document.body.appendChild(modal);

        const grid = modal.querySelector('.theme-grid');
        THEMES.forEach(t => {
            const card = document.createElement('div');
            card.className = 'theme-card';
            card.innerHTML = `<div class="theme-color-preview" style="background:${t.color}"></div><span>${t.name}</span>`;
            card.onclick = () => applyTheme(t.id);
            grid.appendChild(card);
        });
    }

    function applyTheme(id) {
        document.body.setAttribute('data-theme', id);
        localStorage.setItem('kt_theme', id);
        
        // Check config before initializing particles
        const configStr = localStorage.getItem('knowledge-tester-config');
        let shouldAnimate = true;
        if (configStr) {
            const config = JSON.parse(configStr);
            if (config.animationIntensity === 'off') shouldAnimate = false;
        }

        if (shouldAnimate) {
            initParticles(id);
        } else {
            destroyParticles();
        }
        
        document.getElementById('theme-modal').classList.remove('active');
    }

    function destroyParticles() {
        if (window.pJSDom && window.pJSDom.length > 0) {
            window.pJSDom[0].pJS.fn.vendors.destroypJS();
            window.pJSDom = [];
        }
        document.getElementById('particles-js').innerHTML = '';
    }

    function initParticles(themeId) {
        if (!window.particlesJS) return;
        
        // Reset container
        document.getElementById('particles-js').innerHTML = '';

        const color = THEMES.find(t => t.id === themeId)?.color || '#ffffff';
        const isMatrix = themeId === 'matrix' || themeId === 'hacker';
        
        particlesJS('particles-js', {
            "particles": {
                "number": { "value": isMatrix ? 150 : 60 },
                "color": { "value": color },
                "shape": { "type": isMatrix ? "edge" : "circle" },
                "opacity": { "value": 0.5, "random": true },
                "size": { "value": 3, "random": true },
                "line_linked": { "enable": !isMatrix, "distance": 150, "color": color, "opacity": 0.2, "width": 1 },
                "move": { 
                    "enable": true, 
                    "speed": isMatrix ? 10 : 3, 
                    "direction": isMatrix ? "bottom" : "none", 
                    "random": false, 
                    "straight": false, 
                    "out_mode": "out"
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" } }
            },
            "retina_detect": true
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
