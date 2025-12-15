
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';
import * as apiService from '../../services/apiService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as vfxService from '../../services/vfxService.js';

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

function updateHUD() {
    const stats = gamificationService.getStats();
    if(elements.levelDisplay) elements.levelDisplay.textContent = stats.level;
    if(elements.streakDisplay) elements.streakDisplay.textContent = stats.currentStreak;
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
            <div class="mission-content">
                <div class="mission-info">
                    <h4>Current Objective</h4>
                    <h2>${activeJourney.goal}</h2>
                    <div class="mission-meta">
                        <span>Lvl ${activeJourney.currentLevel}</span>
                        <div class="mission-progress-track">
                            <div class="mission-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span>${progressPercent}%</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-resume" id="resume-btn" data-id="${activeJourney.id}">
                    RESUME
                </button>
            </div>
            <!-- Background Decoration -->
            <div style="position:absolute; right:-20px; bottom:-20px; opacity:0.05; transform:rotate(-15deg);">
                <svg class="icon" style="width:150px; height:150px;"><use href="assets/icons/feather-sprite.svg#target"/></svg>
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
    const history = historyService.getRecentHistory(4); // Show 4 items
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = `
            <div style="color:var(--color-text-secondary); font-size:0.85rem; padding:10px; font-style:italic;">
                No recent activity logged.
            </div>`;
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="history-mini-item clickable-history" data-topic="${item.topic}">
            <span class="h-topic">${item.topic}</span>
            <span class="h-meta">
                ${item.type === 'aural' ? 'Audio' : item.score + '/' + item.totalQuestions}
            </span>
        </div>
    `).join('');

    container.querySelectorAll('.clickable-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topicFull = e.currentTarget.dataset.topic;
            const topic = topicFull.split(' - ')[0]; 
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
    const originalIcon = submitBtn.innerHTML;
    submitBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
    submitBtn.disabled = true;
    
    elements.commandInput.value = "Scanning Data Stream...";
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
                <p><strong>Detected Protocol:</strong> ${plan.topicName}</p>
                <p>Generated ${plan.totalLevels}-Level Learning Path.</p>
                <ul class="curriculum-list" style="max-height:150px;overflow-y:auto;background:var(--color-background);padding:10px;border-radius:8px;margin-top:10px;">
                    ${outline.chapters.map(chapter => `<li>${chapter}</li>`).join('')}
                </ul>
            `;

            const confirmed = await showConfirmationModal({
                title: 'Scan Complete',
                message: curriculumHtml,
                confirmText: 'Execute',
                cancelText: 'Discard'
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
            showToast(`Scan failed: ${error.message}`, 'error');
        } finally {
            elements.commandInput.value = '';
            elements.commandInput.disabled = false;
            submitBtn.innerHTML = originalIcon;
            submitBtn.disabled = false;
        }
    };
    reader.readAsDataURL(file);
}

async function initiateQuizGeneration(topic) {
    if (!topic) return;

    const cmdBtn = document.getElementById('command-submit-btn');
    const originalIcon = cmdBtn ? cmdBtn.innerHTML : '';
    
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
            cmdBtn.innerHTML = originalIcon;
            cmdBtn.disabled = false;
        }
    }
}

export function init() {
    elements = {
        greeting: document.getElementById('home-greeting'),
        levelDisplay: document.getElementById('home-level'),
        streakDisplay: document.getElementById('home-streak'),
        resumeSection: document.getElementById('resume-section'),
        commandForm: document.getElementById('command-form'),
        commandInput: document.getElementById('command-input'),
        cameraBtn: document.getElementById('home-camera-btn'),
        fileInput: document.getElementById('home-file-input')
    };

    updateGreeting();
    updateHUD();
    renderResumeCard();
    renderRecentHistory();

    if (elements.commandForm) {
        elements.commandForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = elements.commandInput.value.trim();
            if (topic) {
                initiateQuizGeneration(topic);
            } else {
                showToast("Please enter a directive.", "info");
                elements.commandInput.focus();
            }
        });
    }

    if (elements.cameraBtn) elements.cameraBtn.addEventListener('click', handleCameraClick);
    if (elements.fileInput) elements.fileInput.addEventListener('change', handleFileSelect);

    // Quick Access Protocol Cards
    document.querySelectorAll('.protocol-card').forEach(card => {
        card.addEventListener('click', () => {
            const topic = card.dataset.topic;
            initiateQuizGeneration(topic);
        });
    });
}

export function destroy() {}
