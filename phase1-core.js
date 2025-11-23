
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
        title.innerHTML = '<span>🔥 2025 Trending Tech</span> <button id="help-icon-btn" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--color-text-secondary);">?</button>';

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

        // Setup Help Modal
        document.getElementById('help-icon-btn')?.addEventListener('click', showHelpModal);
    }

    function showHelpModal() {
        const modalHTML = `
            <div class="modal-backdrop" id="phase1-help-backdrop"></div>
            <div class="modal-content" style="max-width: 500px;">
                <h2 style="color: var(--it-secondary);">About IT Quiz Master</h2>
                <p>This platform is exclusively designed for <strong>IT & Programming Professionals</strong>. Our AI is tuned to reject non-technical topics to ensure high-quality, relevant learning.</p>
                <hr style="border-color: var(--color-border); margin: 15px 0;">
                <h3>Keyboard Shortcuts</h3>
                <ul style="list-style: none; padding: 0; color: var(--color-text-secondary);">
                    <li><strong>1-4</strong> : Select Answer</li>
                    <li><strong>Enter</strong> : Submit Answer</li>
                    <li><strong>N</strong> : Next Question</li>
                    <li><strong>S</strong> : Share Results</li>
                </ul>
                <div style="text-align: right; margin-top: 20px;">
                    <button class="btn" id="phase1-help-close">Got it</button>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.id = 'phase1-help-modal';
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const close = () => { modalContainer.remove(); };
        document.getElementById('phase1-help-close').onclick = close;
        document.getElementById('phase1-help-backdrop').onclick = close;
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

            // 1. Direct Validation
            if (isITTopic(val)) {
                return; // Allow
            }

            // 2. Fuzzy Validation
            const suggestion = findClosestMatch(val);
            e.preventDefault();
            e.stopImmediatePropagation();
            
            if (suggestion) {
                showToast(`Did you mean "${suggestion}"? 🧐`, 'info');
                selectTopic(suggestion); // Auto-correct
            } else {
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

    // Levenshtein Distance Algorithm (Vanilla JS)
    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function findClosestMatch(term) {
        let closest = null;
        let minDist = Infinity;
        const threshold = 3; // Max edits allowed

        // Check presets
        IT_PRESETS.forEach(p => {
            const dist = levenshtein(term, p.name.toLowerCase());
            if (dist < minDist && dist <= threshold) {
                minDist = dist;
                closest = p.name;
            }
        });

        // Check keywords if no preset matched well
        if (!closest) {
            IT_KEYWORDS.forEach(kw => {
                const dist = levenshtein(term, kw);
                if (dist < minDist && dist <= 2) { // Stricter for short keywords
                    minDist = dist;
                    closest = kw; // Suggest the keyword itself (generic)
                }
            });
        }
        
        return closest;
    }

    function showToast(msg, type = 'success') {
        const container = document.getElementById('it-toast-container');
        const toast = document.createElement('div');
        toast.className = `it-toast ${type}`;
        
        const icon = type === 'error' ? '🚫' : (type === 'info' ? '💡' : '✅');
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