
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { showConfirmationModal } from '../../services/modalService.js';

let elements = {};

function updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good Morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
    else if (hour >= 17) timeGreeting = "Good Evening";

    const userName = firebaseService.getUserName() || 'Agent';
    
    if (elements.greeting) {
        elements.greeting.textContent = `${timeGreeting}, ${userName}`;
    }
}

function renderResumeCard() {
    const journeys = learningPathService.getAllJourneys();
    
    if (!journeys || journeys.length === 0) {
        if (elements.resumeSection) elements.resumeSection.style.display = 'none';
        return;
    }

    const activeJourney = journeys[0]; 
    const progressPercent = Math.round(((activeJourney.currentLevel - 1) / activeJourney.totalLevels) * 100);

    if (elements.resumeSection) {
        elements.resumeSection.innerHTML = `
            <div class="resume-card">
                <div class="resume-info">
                    <h4>Active Mission</h4>
                    <h2>${activeJourney.goal}</h2>
                    <div class="resume-progress-row">
                        <span>Level ${activeJourney.currentLevel} / ${activeJourney.totalLevels}</span>
                        <div class="resume-track">
                            <div class="resume-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span>${progressPercent}%</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-resume" id="resume-btn" data-id="${activeJourney.id}">
                    RESUME
                </button>
            </div>
        `;
        elements.resumeSection.style.display = 'block';
        
        document.getElementById('resume-btn').addEventListener('click', () => {
            handleResume(activeJourney);
        });
    }
}

function handleResume(journey) {
    const isBoss = (journey.currentLevel % 50 === 0) || (journey.currentLevel === journey.totalLevels);
    stateService.setNavigationContext({
        topic: journey.goal,
        level: journey.currentLevel,
        journeyId: journey.id,
        isBoss: isBoss,
        totalLevels: journey.totalLevels
    });
    window.location.hash = '#/level';
}

function renderRecentHistory() {
    const history = historyService.getRecentHistory(3);
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state-compact" style="color:var(--color-text-secondary); font-size:0.9rem; padding:10px;">
                No recent logs. Initialize a protocol to begin.
            </div>`;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="history-item-row">
            <div class="hist-info">
                <h4 style="margin:0; font-size:0.95rem; color:var(--color-text);">${item.topic}</h4>
                <span class="hist-meta" style="font-size:0.8rem; color:var(--color-text-secondary);">
                    ${item.score}/${item.totalQuestions} Correct • ${new Date(item.date).toLocaleDateString()}
                </span>
            </div>
            <button class="btn-icon-tiny retry-btn" data-topic="${item.topic}" style="color:var(--color-primary); cursor:pointer; background:none; border:none;">
                <svg class="icon" style="width:16px;height:16px;"><use href="assets/icons/feather-sprite.svg#rotate-ccw"/></svg>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.retry-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topic = e.currentTarget.dataset.topic.split(' - ')[0]; 
            initiateQuizGeneration(topic);
        });
    });
}

// --- FILE UPLOAD HANDLERS ---
function handleCameraClick() {
    elements.fileInput.click();
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; // Reset

    const submitBtn = document.getElementById('command-submit-btn');
    submitBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
    submitBtn.disabled = true;
    
    elements.commandInput.value = "Scanning Document...";
    elements.commandInput.disabled = true;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        const mimeType = file.type;

        try {
            const plan = await apiService.generateJourneyFromFile(base64String, mimeType);
            elements.commandInput.value = plan.topicName;
            
            // Preview Modal
            const outline = await apiService.generateCurriculumOutline({ topic: plan.topicName, totalLevels: plan.totalLevels });
            
            const curriculumHtml = `
                <p><strong>Detected Topic:</strong> ${plan.topicName}</p>
                <p>The AI has generated a <strong>${plan.totalLevels}-level journey</strong> based on your image.</p>
                <ul class="curriculum-list" style="max-height:150px;overflow-y:auto;background:var(--color-background);padding:10px;border-radius:8px;">
                    ${outline.chapters.map(chapter => `<li>${chapter}</li>`).join('')}
                </ul>
            `;

            const confirmed = await showConfirmationModal({
                title: 'Image Analyzed',
                message: curriculumHtml,
                confirmText: 'Begin Training',
                cancelText: 'Cancel'
            });

            if (confirmed) {
                const journey = await learningPathService.startOrGetJourney(plan.topicName, {
                    ...plan,
                    styleClass: 'topic-robotics'
                });
                handleResume(journey);
            }

        } catch (error) {
            console.error(error);
            showToast(`Analysis failed: ${error.message}`, 'error');
        } finally {
            elements.commandInput.value = '';
            elements.commandInput.disabled = false;
            submitBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-right"/></svg>`;
            submitBtn.disabled = false;
        }
    };
    reader.readAsDataURL(file);
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;

    const cmdBtn = document.getElementById('command-submit-btn');
    if (cmdBtn) {
        cmdBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
        cmdBtn.disabled = true;
    }

    try {
        const plan = await apiService.generateJourneyPlan(topic);
        const journey = await learningPathService.startOrGetJourney(topic, plan);

        stateService.setNavigationContext({
            topic: journey.goal,
            level: journey.currentLevel,
            journeyId: journey.id,
            isBoss: false,
            totalLevels: journey.totalLevels
        });
        
        window.location.hash = '#/level';

    } catch (error) {
        console.error(error);
        showToast("Error initializing protocol.", "error");
        if (cmdBtn) {
            cmdBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#arrow-right"/></svg>`;
            cmdBtn.disabled = false;
        }
    }
}

export function init() {
    elements = {
        greeting: document.getElementById('home-greeting'),
        resumeSection: document.getElementById('resume-section'),
        commandForm: document.getElementById('command-form'),
        commandInput: document.getElementById('command-input'),
        cameraBtn: document.getElementById('home-camera-btn'),
        fileInput: document.getElementById('home-file-input')
    };

    updateGreeting();
    renderResumeCard();
    renderRecentHistory();

    if (elements.commandForm) {
        elements.commandForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = elements.commandInput.value.trim();
            if (topic) {
                initiateQuizGeneration(topic);
            } else {
                showToast("Please enter a protocol name.", "info");
                elements.commandInput.focus();
            }
        });
    }

    if (elements.cameraBtn) elements.cameraBtn.addEventListener('click', handleCameraClick);
    if (elements.fileInput) elements.fileInput.addEventListener('change', handleFileSelect);

    document.querySelectorAll('.preset-topic').forEach(card => {
        card.addEventListener('click', () => {
            const topic = card.dataset.topic;
            initiateQuizGeneration(topic);
        });
    });
}

export function destroy() {}
