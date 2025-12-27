
import * as firebaseService from './firebaseService.js';
import { renderSidebar } from './sidebarService.js';
import * as backgroundService from './backgroundService.js';
import * as stateService from './stateService.js';
import * as configService from './configService.js';
import * as themeService from './themeService.js';
import * as soundService from './soundService.js';

/**
 * Initializes the common layout shell for an MPA page.
 */
export async function initPageShell(options = { fullBleed: false }) {
    // 1. Setup Shell HTML Structure
    if (!document.getElementById('global-background')) {
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="global-background">
                <div class="blob blob-1"></div>
                <div class="blob blob-2"></div>
                <div class="blob blob-3"></div>
                <div class="bg-grid-overlay"></div>
            </div>
            
            <!-- GLOBAL NEURAL STATUS BAR -->
            <div id="neural-link-bar" class="neural-link-bar">
                <div class="link-indicator">
                    <div id="link-dot" class="link-dot"></div>
                    <span id="link-text">NEURAL LINK: ESTABLISHING...</span>
                </div>
                <div class="node-info">PK-NODE-01</div>
            </div>

            <div id="auth-container"></div>
            <div id="app-wrapper">
                <nav id="sidebar"></nav>
                <main id="app-container" class="${options.fullBleed ? 'full-bleed-container' : ''}">
                    <div id="page-content"></div>
                </main>
            </div>
            <div id="modal-container"></div>
            <div id="toast-container"></div>
        `);
    }

    // 2. Setup Sidebar Interaction (Expand/Collapse on Mobile)
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Expand on click
        sidebar.addEventListener('click', (e) => {
            // Only act if on mobile (checked via width or just always toggle class, CSS handles condition)
            // Stop propagation so document click doesn't immediately close it
            e.stopPropagation();
            sidebar.classList.add('expanded');
        });

        // Close when clicking links inside (Better UX for navigation)
        sidebar.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('button')) {
                // Remove class after small delay to allow visual feedback
                setTimeout(() => sidebar.classList.remove('expanded'), 300);
            }
        });
    }

    // Collapse Sidebar on Outside Click
    document.addEventListener('click', (e) => {
        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('expanded') && !sb.contains(e.target)) {
            sb.classList.remove('expanded');
        }
    });

    // 3. Auth & Connection Monitoring
    return new Promise((resolve) => {
        firebaseService.onAuthChange((user) => {
            const wrapper = document.getElementById('app-wrapper');
            const authContainer = document.getElementById('auth-container');

            if (user) {
                if (wrapper) wrapper.style.display = 'block'; // Matches CSS Media Query default for wrapper
                if (authContainer) authContainer.style.display = 'none';
                
                // Start Continuous Link Monitor
                firebaseService.monitorNeuralLink((status) => {
                    const dot = document.getElementById('link-dot');
                    const text = document.getElementById('link-text');
                    if (dot && text) {
                        text.textContent = `NEURAL LINK: ${status.status}`;
                        dot.className = `link-dot status-${status.status.toLowerCase()}`;
                    }
                });

                configService.init();
                const config = configService.getConfig();
                themeService.applyTheme(config.theme);
                soundService.init(configService);
                stateService.initState();
                backgroundService.init();
                renderSidebar(document.getElementById('sidebar'));
                
                resolve(user);
            } else {
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = '/';
                } else {
                    if (wrapper) wrapper.style.display = 'none';
                    if (authContainer) authContainer.style.display = 'flex';
                    resolve(null);
                }
            }
        });
    });
}
