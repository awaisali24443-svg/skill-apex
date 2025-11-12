import * as learningPathService from '../../services/learningPathService.js';
import { generateLearningPath } from '../../services/apiService.js';
import { initializeCardGlow } from '../../global/global.js';

let form, goalInput, generateBtn, btnText, btnSpinner, savedPathsList, noPathsMessage, template;

function renderSavedPaths() {
    const paths = learningPathService.getAllPaths();
    savedPathsList.innerHTML = '';
    
    if (paths.length === 0) {
        noPathsMessage.style.display = 'block';
    } else {
        noPathsMessage.style.display = 'none';
        paths.forEach(path => {
            const card = template.content.cloneNode(true);
            const cardLink = card.querySelector('.path-item-card');
            cardLink.href = `/#/learning-path/${path.id}`;
            
            card.querySelector('.path-goal').textContent = path.goal;
            const progress = path.currentStep / path.path.length;
            card.querySelector('.path-details').textContent = `${path.path.length} steps • Created on ${new Date(path.createdAt).toLocaleDateString()}`;
            card.querySelector('.progress-bar-fill').style.width = `${progress * 100}%`;
            card.querySelector('.progress-text').textContent = `Progress: ${path.currentStep} / ${path.path.length}`;

            savedPathsList.appendChild(card);
        });
        initializeCardGlow(savedPathsList);
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const goal = goalInput.value.trim();
    if (!goal) return;

    generateBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'block';

    try {
        const result = await generateLearningPath({ goal });
        if (result && result.path) {
            const newPath = learningPathService.addPath(goal, result.path);
            window.location.hash = `#/learning-path/${newPath.id}`;
        }
    } catch (error) {
        console.error("Failed to generate learning path:", error);
    } finally {
        generateBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        goalInput.value = '';
    }
}

export function init(appState) {
    form = document.getElementById('learning-path-form');
    goalInput = document.getElementById('goal-input');
    generateBtn = document.getElementById('generate-path-btn');
    btnText = generateBtn.querySelector('.btn-text');
    btnSpinner = generateBtn.querySelector('.btn-spinner');
    savedPathsList = document.getElementById('saved-paths-list');
    noPathsMessage = document.getElementById('no-paths-message');
    template = document.getElementById('path-item-template');

    form.addEventListener('submit', handleFormSubmit);
    renderSavedPaths();
}

export function destroy() {
    form.removeEventListener('submit', handleFormSubmit);
}
