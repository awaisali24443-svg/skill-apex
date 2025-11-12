export function showFatalError(error) {
    const splash = document.getElementById('splash-screen');
    const appWrapper = document.getElementById('app-wrapper');
    if (appWrapper) appWrapper.style.display = 'none';

    splash.innerHTML = `
        <div class="fatal-error-container">
            <div class="logo">KT</div>
            <h2>Application Error</h2>
            <p>A critical error occurred and the application cannot start.</p>
            <pre>${error.message}</pre>
            <p>Please try refreshing the page. If the problem persists, contact support.</p>
        </div>
    `;
    splash.classList.remove('hidden');

    const style = document.createElement('style');
    style.textContent = `
        .fatal-error-container {
            text-align: center;
            color: var(--color-text-secondary);
            padding: 2rem;
            max-width: 600px;
        }
        .fatal-error-container h2 {
            color: var(--color-error);
            margin-bottom: 1rem;
        }
        .fatal-error-container pre {
            background-color: var(--color-background);
            padding: 1rem;
            border-radius: var(--border-radius);
            border: 1px solid var(--color-border);
            text-align: left;
            margin: 1rem 0;
            color: var(--color-text);
            white-space: pre-wrap;
            word-break: break-all;
        }
    `;
    document.head.appendChild(style);
}
