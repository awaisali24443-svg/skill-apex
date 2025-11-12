import { LOCAL_STORAGE_KEYS } from '../constants.js';
import { showToast } from './toastService.js';

let learningPaths = [];

function loadPaths() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LEARNING_PATHS);
        learningPaths = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load learning paths:", e);
        learningPaths = [];
    }
}

function savePaths() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LEARNING_PATHS, JSON.stringify(learningPaths));
    } catch (e) {
        console.error("Failed to save learning paths:", e);
    }
}

export function init() {
    loadPaths();
}

export function getAllPaths() {
    return learningPaths;
}

export function getPathById(id) {
    return learningPaths.find(p => p.id === id);
}

export function addPath(goal, path) {
    const newPath = {
        id: `path_${Date.now()}`,
        goal,
        path,
        createdAt: new Date().toISOString(),
        currentStep: 0,
    };
    learningPaths.unshift(newPath); // Add to the beginning
    savePaths();
    showToast('New learning path saved!');
    return newPath;
}

export function completeStep(pathId) {
    const path = getPathById(pathId);
    if (path && path.currentStep < path.path.length - 1) {
        path.currentStep += 1;
        savePaths();
        showToast('Step completed! Well done.');
    } else if (path && path.currentStep === path.path.length -1) {
        // Path is complete
        path.currentStep = path.path.length; // Mark as complete
        savePaths();
        showToast('Learning path completed! Congratulations!', 'success');
    }
}

export function deletePath(pathId) {
    learningPaths = learningPaths.filter(p => p.id !== pathId);
    savePaths();
    showToast('Learning path deleted.');
}
