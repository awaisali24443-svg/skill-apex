import { saveNewPath, getAllLearningPaths } from '../../services/learningPathService.js';
import { generateLearningPath } from '../../services/apiService.js';
import { toastService } from '../../services/toastService.js';
import { initializeCardGlow } from '../../global/global.js';

let form, input, button, btnText, loader, errorContainer;

async function handleFormSubmit(e) {
    e.preventDefault();
    const goal = input.value.trim();

    if (!goal) {
        toastService.show("Please enter a learning goal.");
        return;
    }

    setLoading(true);

    try {
        const data = await generateLearningPath(goal);
        const newPath = saveNewPath({ name: goal, steps: data.path });
        
        // Redirect to the newly created path
        window.location.hash = `#/learning-path/${newPath.id}`;

    } catch (error) {
        console.error("Path generation failed:", error);
        errorContainer.textContent = error.message;
        errorContainer.style.display = 'block';
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        button.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        errorContainer.style.display = 'none';
    } else {
        button.disabled = false;
        btnText.style.display = 'inline-block';
        loader.style.display = 'none';
    }
}

function renderSavedPaths() {
    const savedPaths = getAllLearningPaths();
    const listContainer = document.getElementById('saved-paths-list');
    
    if (!listContainer) return;

    if (savedPaths.length > 0) {
        listContainer.innerHTML = savedPaths.map(path => `
            <a href="#/learning-path/${path.id}" class="saved-path-item card">
                <h3>${path.name}</h3>
                <p>${path.steps.length} steps</p>
            </a>
        `).join('');
        initializeCardGlow();
    } else {
        listContainer.innerHTML = `<p class="card" style="text-align: center; color: var(--color-text-muted);">You haven't generated any learning paths yet.</p>`;
    }
}

export function init() {
    form = document.getElementById('path-generator-form');
    input = document.getElementById('goal-input');
    button = form.querySelector('button[type="submit"]');
    btnText = button.querySelector('.btn-text');
    loader = button.querySelector('.loader');
    errorContainer = document.getElementById('path-error-container');

    form.addEventListener('submit', handleFormSubmit);

    renderSavedPaths();

    console.log("Learning Path Generator initialized.");
}

export function destroy() {
    if (form) {
        form.removeEventListener('submit', handleFormSubmit);
    }
    console.log("Learning Path Generator destroyed.");
}