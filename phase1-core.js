/**
 * PHASE 1: IT-FOCUSED CORE & PRESETS
 */

(function() {
    'use strict';

    const CONFIG = {
        ENABLE_PHASE_1: true,
        RESTRICT_TO_IT: true,
        SHOW_PRESETS: true,
        DEBUG_MODE: false,
        SELECTORS: {
            input: 'input[type="text"]',
            button: 'button',
            container: 'body'
        }
    };

    if (!CONFIG.ENABLE_PHASE_1) return;

    const IT_PRESETS = [
        { name: "Python", icon: "🐍" },
        { name: "JavaScript", icon: "⚡" },
        { name: "Rust", icon: "🦀" },
        { name: "Go Lang", icon: "🐹" },
        { name: "TypeScript", icon: "📘" },
        { name: "Agentic AI", icon: "🤖" },
        { name: "Cybersecurity", icon: "🛡️" },
        { name: "React 19", icon: "⚛️" },
        { name: "Cloud Native", icon: "☁️" },
        { name: "Quantum Comp.", icon: "⚛" },
        { name: "Docker/K8s", icon: "🐳" },
        { name: "System Design", icon: "🏗️" },
        { name: "Data Structures", icon: "🌳" },
        { name: "Algorithms", icon: "🧮" },
        { name: "SQL & NoSQL", icon: "💾" },
        { name: "Next.js", icon: "▲" },
        { name: "GraphQL", icon: "◈" },
        { name: "Linux", icon: "🐧" },
        { name: "Git & DevOps", icon: "🔧" },
        { name: "Web3/Blockchain", icon: "⛓️" }
    ];

    const IT_KEYWORDS = [
        "code", "program", "software", "comput", "data", "cyber", "tech", "web", 
        "app", "api", "ai", "network", "server", "linux", "java", "script", 
        "logic", "design", "hack", "cloud", "robot", "sys", "db", "sql", "git"
    ];

    function initPhase1() {
        if (CONFIG.DEBUG_MODE) console.log("Phase 1 Initializing...");
        mountUI();
        attachInterceptors();
    }

    function mountUI() {
        const inputEl = document.querySelector(CONFIG.SELECTORS.input);
        const mountPoint = inputEl ? inputEl.parentElement : document.body;

        const container = document.createElement('div');
        container.id = 'it-preset-container';

        const surpriseBtn = document.createElement('button');
        surpriseBtn.id = 'it-surprise-btn';
        surpriseBtn.innerHTML = '🎲 Surprise Me!';
        surpriseBtn.onclick = handleSurpriseMe;

        const title = document.createElement('div');
        title.className = 'it-section-title';
        title.innerHTML = '<span>🔥 2025 Trending Tech</span>';

        const grid = document.createElement('div');
        grid.className = 'it-preset-grid';

        IT_PRESETS.forEach(topic => {
            const card = document.createElement('div');
            card.className = 'it-topic-card';
            card.innerHTML = `
                <div class="it-topic-icon">${topic.icon}</div>
                <div class="it-topic-name">${topic.name}</div>
            `;
            card.onclick = () => selectTopic(topic.name);
            grid.appendChild(card);
        });

        const toastContainer = document.createElement('div');
        toastContainer.id = 'it-toast-container';
        document.body.appendChild(toastContainer);

        container.appendChild(surpriseBtn);
        if (CONFIG.SHOW_PRESETS) {
            container.appendChild(title);
            container.appendChild(grid);
        }

        if (inputEl) {
            mountPoint.insertBefore(container, inputEl);
        } else {
            document.body.insertBefore(container, document.body.firstChild);
        }
    }

    function selectTopic(topicName) {
        const input = document.querySelector(CONFIG.SELECTORS.input);
        if (input) {
            input.value = topicName;
            input.focus();
            input.style.transition = "background-color 0.3s";
            input.style.backgroundColor = "rgba(0, 255, 136, 0.1)";
            setTimeout(() => input.style.backgroundColor = "", 300);
        }
    }

    function handleSurpriseMe(e) {
        e.preventDefault();
        const randomTopic = IT_PRESETS[Math.floor(Math.random() * IT_PRESETS.length)];
        selectTopic(randomTopic.name);
        showToast(`Selected: ${randomTopic.name}. Hit Generate!`, 'success');
    }

    function attachInterceptors() {
        const btn = document.querySelector(CONFIG.SELECTORS.button);
        if (!btn) return;

        btn.addEventListener('click', function(e) {
            if (!CONFIG.RESTRICT_TO_IT) return;

            const input = document.querySelector(CONFIG.SELECTORS.input);
            const val = input ? input.value.trim().toLowerCase() : '';

            if (!val) return; 

            if (!isITTopic(val)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                showToast("⚠️ Stick to Tech! Try a preset below.", 'error');
                highlightGrid();
            }
        }, true);
    }

    function isITTopic(term) {
        if (IT_PRESETS.some(p => p.name.toLowerCase() === term)) return true;
        if (IT_KEYWORDS.some(kw => term.includes(kw))) return true;
        return false; 
    }

    function showToast(msg, type = 'success') {
        const container = document.getElementById('it-toast-container');
        const toast = document.createElement('div');
        toast.className = `it-toast ${type}`;
        
        const icon = type === 'error' ? '🚫' : '✅';
        toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'it-slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function highlightGrid() {
        const grid = document.querySelector('.it-preset-grid');
        grid.style.transition = "transform 0.2s";
        grid.style.transform = "scale(1.02)";
        setTimeout(() => grid.style.transform = "scale(1)", 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPhase1);
    } else {
        initPhase1();
    }
})();